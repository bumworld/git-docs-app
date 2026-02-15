import { watch } from 'chokidar';
import path from 'path';
import { runBuild } from './build.js';
import { PATHS, BUILD } from '../config/constants.js';
import {
  createBuild,
  updateBuildSuccess,
  updateBuildFailed,
  cleanupOldBuilds,
} from '../server/db.js';

export function createBuildRunner() {
  let building = false;
  let pendingBuild = null;
  let debounceTimer = null;

  async function executeBuild(triggerType = 'manual', triggeredBy = 'system') {
    if (building) {
      pendingBuild = { triggerType: 'watcher', triggeredBy: 'system' };
      console.log('[Watcher] Build already in progress, queuing next build...');
      return;
    }

    building = true;
    console.log(`[Watcher] Triggering build (${triggerType} by ${triggeredBy})...`);

    let buildId;
    try {
      buildId = createBuild(triggerType, triggeredBy);
    } catch (err) {
      console.error('[Watcher] Failed to create build record:', err.message);
    }

    try {
      const result = await runBuild();
      if (buildId) {
        if (result.success) {
          updateBuildSuccess(buildId, result.log, result.durationMs, result.failedFiles);
        } else {
          updateBuildFailed(buildId, result.log, result.durationMs, result.failedFiles);
        }
        // Cleanup old builds
        try { cleanupOldBuilds(200); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('[Watcher] Build error:', err.message);
      if (buildId) {
        try { updateBuildFailed(buildId, err.message, 0, []); } catch (e) { /* ignore */ }
      }
    } finally {
      building = false;
      if (pendingBuild) {
        const next = pendingBuild;
        pendingBuild = null;
        console.log('[Watcher] Running queued build...');
        executeBuild(next.triggerType, next.triggeredBy);
      }
    }
  }

  function debouncedBuild() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      executeBuild('watcher', 'system');
    }, BUILD.DEBOUNCE_MS);
  }

  function startWatching() {
    console.log(`[Watcher] Watching source/ for changes...`);

    const watcher = watch(PATHS.SOURCE, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
      ignored: /(^|[\/\\])\../,
    });

    watcher.on('add', (filePath) => {
      console.log(`[Watcher] File added: ${path.relative(PATHS.SOURCE, filePath)}`);
      debouncedBuild();
    });

    watcher.on('change', (filePath) => {
      console.log(`[Watcher] File changed: ${path.relative(PATHS.SOURCE, filePath)}`);
      debouncedBuild();
    });

    watcher.on('unlink', (filePath) => {
      console.log(`[Watcher] File removed: ${path.relative(PATHS.SOURCE, filePath)}`);
      debouncedBuild();
    });

    watcher.on('addDir', (dirPath) => {
      if (dirPath !== PATHS.SOURCE) {
        console.log(`[Watcher] Directory added: ${path.relative(PATHS.SOURCE, dirPath)}`);
        debouncedBuild();
      }
    });

    watcher.on('unlinkDir', (dirPath) => {
      console.log(`[Watcher] Directory removed: ${path.relative(PATHS.SOURCE, dirPath)}`);
      debouncedBuild();
    });

    watcher.on('error', (err) => {
      console.error('[Watcher] Error:', err.message);
    });

    return watcher;
  }

  return {
    triggerBuild: (triggerType, triggeredBy) => executeBuild(triggerType || 'manual', triggeredBy || 'system'),
    startWatching,
    isBuilding: () => building,
  };
}
