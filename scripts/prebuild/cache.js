import fs from 'fs-extra';

/**
 * 캐시 스키마 버전.
 *
 * 캐시는 mtime/size 기반이라 슬러그 정규화 규칙이 바뀌어도 cache hit 가 발생해
 * 옛 규칙으로 만든 목적 파일이 그대로 남는다. 정규화 알고리즘/출력 구조를 바꿀 때마다
 * 이 값을 올리면 버전 불일치로 캐시가 통째로 무효화되어 첫 실행처럼 전체 재처리된다.
 *
 * v2: sanitize() 에 github-slugger 최종 패스 추가 (`실행·예약` → `실행예약`)
 */
export const CACHE_SCHEMA_VERSION = 2;

export function loadCache(cachePath) {
  const empty = { files: {}, slugVersion: CACHE_SCHEMA_VERSION };
  if (!fs.existsSync(cachePath)) return empty;
  try {
    const raw = fs.readJsonSync(cachePath);
    if (raw.slugVersion !== CACHE_SCHEMA_VERSION) {
      return { ...empty, sourceDir: raw.sourceDir, versionMismatch: true, previousVersion: raw.slugVersion ?? null };
    }
    return { ...raw, files: raw.files || {} };
  } catch {
    return empty;
  }
}

export function saveCache(cachePath, files, sourceDir) {
  try {
    fs.outputJsonSync(
      cachePath,
      { slugVersion: CACHE_SCHEMA_VERSION, sourceDir, files },
      { spaces: 2 }
    );
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
