import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { runPrebuild } from './prebuild.js';
import { PATHS } from '../config/constants.js';
import { loadGitdocsConfig } from './prebuild/config.js';
import { runHooks } from './build-hooks.js';

function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(/\s+/);
    const child = spawn(cmd, args, { ...options, shell: true });
    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', (data) => { stdout += data.toString(); });
    if (child.stderr) child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(`Command failed with exit code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve(stdout);
      }
    });
    child.on('error', (err) => {
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

export function reportCommandFailure(err) {
  console.error('[Build] Build failed:', err.message);
  if (err.stderr) console.error(err.stderr.toString().trimEnd());
  if (err.stdout) console.error(err.stdout.toString().trimEnd());
}

function loadSiteSettings() {
  if (!fs.existsSync(PATHS.DB)) return {};
  try {
    const db = new Database(PATHS.DB, { readonly: true });
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    db.close();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  } catch {
    return {};
  }
}

// reveal.js 정적 에셋을 public/reveal 로 복사 (프레젠테이션 모드용).
// node_modules 직접 노출 대신 dist 로 번들되도록 하여 프로덕션 404 를 방지한다.
function copyRevealAssets() {
  const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkgDir = path.join(APP_ROOT, 'node_modules', 'reveal.js');
  const src = path.join(pkgDir, 'dist');
  const dest = path.join(APP_ROOT, 'public', 'reveal');
  if (!fs.existsSync(src)) return;
  // 설치된 reveal.js 버전을 마커로 사용 — 버전 불일치(업그레이드)나 누락 시에만 재복사하여 stale 방지
  let version = '';
  try { version = fs.readJsonSync(path.join(pkgDir, 'package.json')).version || ''; } catch { /* ignore */ }
  const marker = path.join(dest, '.reveal-version');
  const current = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf-8').trim() : '';
  if (current === version && fs.existsSync(path.join(dest, 'reveal.js'))) return;
  fs.emptyDirSync(dest);
  fs.copySync(src, dest, { overwrite: true });
  fs.writeFileSync(marker, version);
  console.log(`[Build] reveal.js 에셋을 public/reveal 로 복사 (v${version || 'unknown'})`);
}

// dist 디렉토리 자체는 Docker 볼륨 마운트 포인트일 수 있다.
// 마운트 포인트는 rename/remove 시 EBUSY 가 나므로, dist inode 는 보존하고 "내용"만 옮긴다.
// (자식 엔트리 이동은 마운트 포인트여도 안전 — 같은 FS면 즉시 rename, 교차 FS면 fs-extra 가 copy+unlink 폴백)
export function moveDirContents(srcDir, destDir) {
  fs.ensureDirSync(destDir);
  for (const entry of fs.readdirSync(srcDir)) {
    fs.moveSync(path.join(srcDir, entry), path.join(destDir, entry), { overwrite: true });
  }
}

function extractFailedFiles(output) {
  const failed = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Match common Astro/Vite build error patterns referencing files
    const fileMatch = line.match(/(?:error|fail|Error|FAIL).*?[:\s]+((?:\/|\.\/|src\/|source\/).+?\.\w+)/i);
    if (fileMatch && failed.length < 100) {
      const filePath = fileMatch[1].trim();
      if (!failed.includes(filePath)) {
        failed.push(filePath);
      }
    }
  }
  return failed;
}

export async function runBuild() {
  console.log('[Build] Starting full build pipeline...');
  const startTime = Date.now();
  const logParts = [];
  // dist 내용 교체(swap)에 진입했는지 추적 — 실패 시 롤백 판단에 사용.
  // swap 도중 실패하면 dist 가 부분 상태일 수 있어 dist-old 로 전체 복구해야 한다.
  let syncStarted = false;

  // 훅에 공유되는 컨텍스트 (단계 진행에 따라 채워짐)
  const ctx = { startTime, paths: PATHS, env: {}, settings: {} };

  try {
    // Step 1: Prebuild - sync source/ to src/content/docs/
    await runHooks('pre-prebuild', ctx);
    logParts.push('[Prebuild] Starting prebuild...');
    const hasContent = runPrebuild();
    logParts.push('[Prebuild] Prebuild completed.');
    await runHooks('post-prebuild', { ...ctx, hasContent });

    // Step 2: Read site settings from DB and pass to Astro build
    const settings = loadSiteSettings();
    // .gitdocs.json title/description으로 DB에 없는 값 채우기 (DB 설정이 우선)
    const gitdocsConfig = loadGitdocsConfig(PATHS.SOURCE);
    if (!settings.site_title && gitdocsConfig.title) settings.site_title = gitdocsConfig.title;
    if (!settings.site_description && gitdocsConfig.description) settings.site_description = gitdocsConfig.description;
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_description) buildEnv.SITE_DESCRIPTION = settings.site_description;
    if (settings.site_url) buildEnv.SITE_URL = settings.site_url;
    const titleMsg = `[Build] Site title: "${buildEnv.SITE_TITLE || 'Git Docs'}"`;
    console.log(titleMsg);
    logParts.push(titleMsg);
    ctx.settings = settings;
    ctx.env = buildEnv;

    // Step 3: Run Astro build to temp directory (async - does not block event loop)
    await runHooks('pre-astro', ctx);
    copyRevealAssets();
    console.log('[Build] Running Astro build...');
    logParts.push('[Build] Running Astro build...');
    const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const astroBin = path.join(APP_ROOT, 'node_modules', '.bin', 'astro');
    const stdout = await execAsync(`"${astroBin}" build --outDir "${PATHS.DIST_TEMP}"`, {
      cwd: APP_ROOT,
      env: buildEnv,
    });
    if (stdout) logParts.push(stdout.trim());
    await runHooks('post-astro', { ...ctx, stdout });

    // Step 4: Sync build output to dist directory
    await runHooks('pre-sync', { ...ctx, hasContent });
    if (!hasContent) {
      const skipMsg = '[Build] source/ was empty — skipping dist update to preserve existing content';
      console.log(skipMsg);
      logParts.push(skipMsg);
      fs.removeSync(PATHS.DIST_TEMP);
    } else {
      console.log('[Build] Syncing build output to dist...');
      logParts.push('[Build] Syncing build output to dist...');

      // dist 디렉토리 자체(Docker 볼륨 마운트 포인트일 수 있음)는 rename/remove 하지 않고
      // 내용만 교체한다. dist 를 rename 하면 마운트 포인트에서 EBUSY 가 발생한다.
      // 기존 dist 내용 → dist-old 로 이동(롤백 백업). dist 는 비워지지만 디렉토리는 유지.
      if (fs.existsSync(PATHS.DIST) && fs.readdirSync(PATHS.DIST).length > 0) {
        fs.emptyDirSync(PATHS.DIST_OLD);
        moveDirContents(PATHS.DIST, PATHS.DIST_OLD);
        const backupMsg = '[Build] Backed up dist/ to dist-old/';
        console.log(backupMsg);
        logParts.push(backupMsg);
      }

      // dist-temp 내용 → dist 로 교체 (dist inode 보존)
      // 이 지점부터 dist 가 부분 상태가 될 수 있으므로 실패 시 dist-old 전체 복구가 필요하다.
      syncStarted = true;
      fs.emptyDirSync(PATHS.DIST);
      moveDirContents(PATHS.DIST_TEMP, PATHS.DIST);
      fs.removeSync(PATHS.DIST_TEMP);
    }
    await runHooks('post-sync', { ...ctx, hasContent });

    const durationMs = Date.now() - startTime;
    const elapsed = (durationMs / 1000).toFixed(1);
    const completeMsg = `[Build] Build completed in ${elapsed}s`;
    console.log(completeMsg);
    logParts.push(completeMsg);

    return {
      success: true,
      log: logParts.join('\n'),
      durationMs,
      failedFiles: [],
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    reportCommandFailure(err);

    // Capture stderr/stdout from the error
    let errorOutput = err.message || '';
    if (err.stderr) errorOutput += '\n' + err.stderr.toString();
    if (err.stdout) errorOutput += '\n' + err.stdout.toString();
    logParts.push('[Build] Build FAILED:');
    logParts.push(errorOutput.trim());

    const failedFiles = extractFailedFiles(errorOutput);
    if (failedFiles.length > 0) {
      logParts.push(`\n[Build] Failed files (${failedFiles.length}${failedFiles.length >= 100 ? '+' : ''}):`);
      failedFiles.forEach(f => logParts.push(`  - ${f}`));
      if (failedFiles.length >= 100) {
        logParts.push('  ... (showing first 100 files, check full error output for more)');
      }
    }

    // on-error 훅 실행
    await runHooks('on-error', { ...ctx, error: err });

    // Cleanup: remove temp dir if it exists
    if (fs.existsSync(PATHS.DIST_TEMP)) {
      fs.removeSync(PATHS.DIST_TEMP);
    }

    // 롤백 시도: dist-old 에 직전 배포본이 있고, dist 가 신뢰할 수 없는 상태일 때 복구.
    // - dist 가 비어있음(스왑 전 초기화만 됨), 또는
    // - 스왑 도중 실패(syncStarted) → dist 가 부분 상태일 수 있음.
    // 스왑 전에 실패해 dist 에 기존 정상 배포본이 그대로 있으면(distIsEmpty=false && !syncStarted) 건드리지 않는다.
    const distIsEmpty = !fs.existsSync(PATHS.DIST) || fs.readdirSync(PATHS.DIST).length === 0;
    const distOldHasContent = fs.existsSync(PATHS.DIST_OLD) && fs.readdirSync(PATHS.DIST_OLD).length > 0;
    if ((distIsEmpty || syncStarted) && distOldHasContent) {
      try {
        // dist 부분 상태를 비우고(마운트 안전) dist-old 내용으로 전체 복구
        fs.emptyDirSync(PATHS.DIST);
        fs.copySync(PATHS.DIST_OLD, PATHS.DIST);
        const rollbackMsg = '[Build] Rolled back dist/ from dist-old/';
        console.log(rollbackMsg);
        logParts.push(rollbackMsg);
      } catch (rollbackErr) {
        const rollbackErrMsg = `[Build] Rollback failed: ${rollbackErr.message}`;
        console.error(rollbackErrMsg);
        logParts.push(rollbackErrMsg);
      }
    }

    return {
      success: false,
      log: logParts.join('\n'),
      durationMs,
      failedFiles,
    };
  }
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  runBuild().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}
