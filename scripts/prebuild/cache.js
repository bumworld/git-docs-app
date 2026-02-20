import fs from 'fs-extra';

export function loadCache(cachePath) {
  if (!fs.existsSync(cachePath)) return { files: {} };
  try {
    return fs.readJsonSync(cachePath);
  } catch {
    return { files: {} };
  }
}

export function saveCache(cachePath, files, sourceDir) {
  try {
    fs.outputJsonSync(cachePath, { sourceDir, files }, { spaces: 2 });
  } catch (err) {
    console.warn('[Prebuild] 캐시 저장 실패:', err.message);
  }
}

export function getFileStat(filePath) {
  try {
    const s = fs.statSync(filePath);
    return { mtime: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}
