import { spawn } from 'child_process';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { runPrebuild } from './prebuild.js';
import { PATHS } from '../config/constants.js';

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
    runPrebuild();
    logParts.push('[Prebuild] Prebuild completed.');

    // Step 2: Read site settings from DB and pass to Astro build
    const settings = loadSiteSettings();
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_description) buildEnv.SITE_DESCRIPTION = settings.site_description;
    const titleMsg = `[Build] Site title: "${buildEnv.SITE_TITLE || 'Git Docs'}"`;
    console.log(titleMsg);
    logParts.push(titleMsg);

    // Step 3: Run Astro build to temp directory (async - does not block event loop)
    console.log('[Build] Running Astro build...');
    logParts.push('[Build] Running Astro build...');
    const stdout = await execAsync(`npx astro build --outDir "${PATHS.DIST_TEMP}"`, {
      cwd: process.cwd(),
      env: buildEnv,
    });
    if (stdout) logParts.push(stdout.trim());

    // Step 4: Sync build output to dist directory
    console.log('[Build] Syncing build output to dist...');
    logParts.push('[Build] Syncing build output to dist...');
    fs.ensureDirSync(PATHS.DIST);
    fs.emptyDirSync(PATHS.DIST);
    fs.copySync(PATHS.DIST_TEMP, PATHS.DIST);
    fs.removeSync(PATHS.DIST_TEMP);

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
