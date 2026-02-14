import { watch } from 'chokidar';
import path from 'path';
import { runBuild } from './build.js';
import { PATHS, BUILD } from '../config/constants.js';

export function createBuildRunner() {
  let building = false;
  let pendingBuild = false;
  let debounceTimer = null;

  async function executeBuild() {
    if (building) {
      pendingBuild = true;
      console.log('[Watcher] Build already in progress, queuing next build...');
      return;
    }

    building = true;
    console.log('[Watcher] Triggering build...');

    try {
      runBuild();
    } catch (err) {
      console.error('[Watcher] Build error:', err.message);
    } finally {
      building = false;
      if (pendingBuild) {
        pendingBuild = false;
        console.log('[Watcher] Running queued build...');
        executeBuild();
      }
    }
  }

  function debouncedBuild() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      executeBuild();
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
      ignored: /(^|[\/\\])\../, // ignore dotfiles
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
    triggerBuild: () => executeBuild(),
    startWatching,
    isBuilding: () => building,
  };
}
