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

/**
 * 증분 캐시를 무효화한다 (실패한 prebuild 의 부분 산출물이 다음 실행에서 cache hit 로
 * 재사용되는 것을 막기 위함).
 *
 * 삭제가 막히는 환경(권한, 파일 락 등)을 대비해 2단계로 시도한다.
 *   1) 파일 삭제 → 다음 loadCache 가 빈 캐시를 반환
 *   2) 내용 파괴 → 다음 loadCache 의 JSON 파싱이 실패해 빈 캐시로 폴백
 * 둘 다 실패하면 false 를 반환한다 (호출부가 운영자에게 알린다).
 *
 * @returns {boolean} 무효화 성공 여부
 */
export function invalidateCache(cachePath) {
  if (!fs.existsSync(cachePath)) return true;
  try {
    fs.removeSync(cachePath);
    return true;
  } catch (err) {
    console.warn(`[Prebuild] 캐시 삭제 실패, 내용 파괴로 재시도: ${err.message}`);
  }
  try {
    fs.writeFileSync(cachePath, '');
    return true;
  } catch (err) {
    console.error(`[Prebuild] 캐시 무효화 실패: ${err.message}`);
    return false;
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
