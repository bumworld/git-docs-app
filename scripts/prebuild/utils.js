import path from 'path';
import { slug as githubSlug } from 'github-slugger';

/**
 * 슬러그 정규화 실패(빈 문자열) 오류.
 * 상위(processDirectory)에서 원본 상대 경로 컨텍스트를 붙여 다시 던진다.
 */
export class SlugError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SlugError';
  }
}

/**
 * 파일 처리(I/O) 오류로 prebuild 를 중단시키는 오류.
 *
 * processor 들은 개별 파일 오류를 stats.errors 에 모으고 계속 진행한다. 그대로 두면
 * 일부 문서가 누락된 채 빌드가 "성공"으로 기록되므로, 순회가 끝난 뒤 오류가 하나라도
 * 있으면 이 오류를 던져 빌드를 실패시킨다.
 *
 * @param {Array<{ file: string, message: string }>} errors 처리 실패 목록
 */
export class PrebuildError extends Error {
  constructor(errors = []) {
    super(
      `[Prebuild] 파일 처리 오류 ${errors.length}개로 빌드를 중단합니다.\n` +
      errors.map(e => `  - ${e.file} → ${e.message}`).join('\n')
    );
    this.name = 'PrebuildError';
    this.count = errors.length;
    this.errors = errors;
  }
}

/**
 * Sanitize a string for use in URL slugs.
 * Keeps: alphanumeric, Korean/CJK/Unicode letters, hyphens, underscores
 * Removes: dots, ()[]{}#&+%@!;,='"`~$^|?*<>:\
 * Collapses multiple hyphens, trims leading/trailing hyphens
 *
 * 마지막에 github-slugger(`slug`)를 한 번 더 적용해 Astro Starlight docsLoader 의
 * 슬러그 규칙과 결과를 일치시킨다. (docsLoader 는 파일 경로 세그먼트마다 github-slugger 를 적용)
 * 예) "실행·예약" → 자체 규칙만 쓰면 "실행·예약" 이지만 docsLoader 는 "실행예약" 을 만들어
 *     사이드바 slug 과 콘텐츠 slug 이 어긋나 Starlight 빌드가 중단된다.
 *
 * maintainCase=true 로 호출해 기존 반환 계약(케이스 보존)을 유지한다.
 * (호출부에서 .toLowerCase() 를 적용)
 *
 * Note: Dots are removed to match Starlight docsLoader() slug normalization.
 * e.g. "libs.versions" → "libsversions", "build.gradle" → "buildgradle"
 *
 * @param {string} str 정규화할 문자열
 * @param {string} original 오류 메시지에 표기할 원본 이름
 * @throws {SlugError} 정규화 결과가 빈 문자열인 경우
 */
function sanitize(str, original = str) {
  const legacySanitized = str
    .normalize('NFC')  // macOS NFD(자모 분리) → NFC 정규화
    .replace(/[\s]+/g, '-')
    .replace(/[.()[\]{}#&+%@!;,='"`~$^|?*<>:\\]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  const slug = githubSlug(legacySanitized, true);

  if (!slug) {
    throw new SlugError(
      `슬러그 정규화 결과가 비었습니다: "${original}" — URL 로 쓸 수 있는 문자(영문/숫자/한글 등)를 포함하도록 이름을 변경하세요.`
    );
  }

  return slug;
}

export function sanitizeSlug(name) {
  const ext = path.extname(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  return sanitize(base, name);
}

export function sanitizeDirName(name) {
  return sanitize(name);
}

export function generateTitle(filename) {
  const name = path.basename(filename, path.extname(filename));
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export function formatFileSize(bytes) {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
