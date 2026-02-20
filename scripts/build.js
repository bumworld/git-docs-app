import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { runPrebuild } from './prebuild.js';
import { PATHS } from '../config/constants.js';
import { loadGitdocsConfig } from './prebuild/config.js';

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

  try {
    // Step 1: Prebuild - sync source/ to src/content/docs/
    logParts.push('[Prebuild] Starting prebuild...');
    const hasContent = runPrebuild();
    logParts.push('[Prebuild] Prebuild completed.');

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

    // Step 3: Run Astro build to temp directory (async - does not block event loop)
    console.log('[Build] Running Astro build...');
    logParts.push('[Build] Running Astro build...');
    const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const astroBin = path.join(APP_ROOT, 'node_modules', '.bin', 'astro');
    const stdout = await execAsync(`"${astroBin}" build --outDir "${PATHS.DIST_TEMP}"`, {
      cwd: APP_ROOT,
      env: buildEnv,
    });
    if (stdout) logParts.push(stdout.trim());

    // Step 4: Sync build output to dist directory
    if (!hasContent) {
      const skipMsg = '[Build] source/ was empty — skipping dist update to preserve existing content';
      console.log(skipMsg);
      logParts.push(skipMsg);
      fs.removeSync(PATHS.DIST_TEMP);
    } else {
      console.log('[Build] Syncing build output to dist...');
      logParts.push('[Build] Syncing build output to dist...');

      // 기존 dist → dist-old 백업 (롤백 지원)
      if (fs.existsSync(PATHS.DIST) && fs.readdirSync(PATHS.DIST).length > 0) {
        fs.ensureDirSync(PATHS.DIST_OLD);
        fs.emptyDirSync(PATHS.DIST_OLD);
        fs.copySync(PATHS.DIST, PATHS.DIST_OLD);
        const backupMsg = '[Build] Backed up dist/ to dist-old/';
        console.log(backupMsg);
        logParts.push(backupMsg);
      }

      fs.ensureDirSync(PATHS.DIST);
      fs.emptyDirSync(PATHS.DIST);
      fs.copySync(PATHS.DIST_TEMP, PATHS.DIST);
      fs.removeSync(PATHS.DIST_TEMP);
    }

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
    console.error('[Build] Build failed:', err.message);

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

    // Cleanup: remove temp dir if it exists
    if (fs.existsSync(PATHS.DIST_TEMP)) {
      fs.removeSync(PATHS.DIST_TEMP);
    }

    // 롤백 시도: dist가 비어있고 dist-old가 있으면 복구
    // (dist에 내용이 있으면 기존 배포본 유지, 건드리지 않음)
    const distIsEmpty = !fs.existsSync(PATHS.DIST) || fs.readdirSync(PATHS.DIST).length === 0;
    if (distIsEmpty && fs.existsSync(PATHS.DIST_OLD) && fs.readdirSync(PATHS.DIST_OLD).length > 0) {
      try {
        fs.ensureDirSync(PATHS.DIST);
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
