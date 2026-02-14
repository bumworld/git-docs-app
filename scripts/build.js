import { execSync } from 'child_process';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { runPrebuild } from './prebuild.js';
import { PATHS } from '../config/constants.js';

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

export function runBuild() {
  console.log('[Build] Starting full build pipeline...');
  const startTime = Date.now();

  try {
    // Step 1: Prebuild - sync source/ to src/content/docs/
    runPrebuild();

    // Step 2: Read site settings from DB and pass to Astro build
    const settings = loadSiteSettings();
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_description) buildEnv.SITE_DESCRIPTION = settings.site_description;
    console.log(`[Build] Site title: "${buildEnv.SITE_TITLE || 'Git Docs'}"`);

    // Step 3: Run Astro build to temp directory
    console.log('[Build] Running Astro build...');
    execSync(`npx astro build --outDir "${PATHS.DIST_TEMP}"`, {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: buildEnv,
    });

    // Step 3: Atomic swap - rename dist-temp to dist
    console.log('[Build] Swapping dist directories...');
    if (fs.existsSync(PATHS.DIST_OLD)) {
      fs.removeSync(PATHS.DIST_OLD);
    }
    if (fs.existsSync(PATHS.DIST)) {
      fs.moveSync(PATHS.DIST, PATHS.DIST_OLD, { overwrite: true });
    }
    fs.moveSync(PATHS.DIST_TEMP, PATHS.DIST, { overwrite: true });

    // Clean up old dist
    if (fs.existsSync(PATHS.DIST_OLD)) {
      fs.removeSync(PATHS.DIST_OLD);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Build] Build completed in ${elapsed}s`);
    return true;
  } catch (err) {
    console.error('[Build] Build failed:', err.message);

    // Rollback: remove temp dir if it exists
    if (fs.existsSync(PATHS.DIST_TEMP)) {
      fs.removeSync(PATHS.DIST_TEMP);
    }
    // Restore old dist if swap failed
    if (!fs.existsSync(PATHS.DIST) && fs.existsSync(PATHS.DIST_OLD)) {
      fs.moveSync(PATHS.DIST_OLD, PATHS.DIST, { overwrite: true });
    }
    return false;
  }
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  const success = runBuild();
  process.exit(success ? 0 : 1);
}
