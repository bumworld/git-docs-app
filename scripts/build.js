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

    // Step 3: Sync build output to dist directory
    console.log('[Build] Syncing build output to dist...');
    fs.ensureDirSync(PATHS.DIST);
    fs.emptyDirSync(PATHS.DIST);
    fs.copySync(PATHS.DIST_TEMP, PATHS.DIST);
    fs.removeSync(PATHS.DIST_TEMP); // Clean up temp dir

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Build] Build completed in ${elapsed}s`);
    return true;
  } catch (err) {
    console.error('[Build] Build failed:', err.message);

    // Cleanup: remove temp dir if it exists
    if (fs.existsSync(PATHS.DIST_TEMP)) {
      fs.removeSync(PATHS.DIST_TEMP);
    }
    // Note: The /dist directory might be in an incomplete state if the copy failed.
    // A failed build won't be deployed.
    return false;
  }
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  const success = runBuild();
  process.exit(success ? 0 : 1);
}
