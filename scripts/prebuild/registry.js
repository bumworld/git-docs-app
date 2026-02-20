/**
 * Processor 플러그인 레지스트리
 *
 * 파일 타입별 처리 핸들러를 등록하고, 주어진 파일에 맞는 핸들러를 찾아 실행합니다.
 * processDirectory()의 if/else 분기를 대체합니다.
 *
 * 핸들러 인터페이스:
 * {
 *   name:    string                                  핸들러 식별자
 *   match:   (ext, srcPath, entry) => boolean        파일 매칭 조건
 *   process: (srcPath, relPath, ctx) => string[]     처리 후 생성된 destFiles 반환
 * }
 *
 * ctx 구조:
 * {
 *   docsSubDir:      string   docs 출력 디렉토리
 *   downloadsSubDir: string   downloads 출력 디렉토리
 *   stats:           object   처리 통계
 *   safeFileName:    string   슬러그 정규화된 파일명
 *   entry:           Dirent   원본 디렉토리 엔트리
 * }
 */

const _handlers = [];

/**
 * 핸들러 등록
 * @param {{ name: string, match: function, process: function }} handler
 */
export function register(handler) {
  _handlers.push(handler);
}

/**
 * 파일에 맞는 첫 번째 핸들러를 찾아 실행
 * @param {string} ext - 파일 확장자 (소문자)
 * @param {string} srcPath - 원본 파일 전체 경로
 * @param {string} relPath - source 루트 기준 상대 경로
 * @param {object} ctx - 처리 컨텍스트
 * @returns {string[]} 생성된 destFiles 목록
 */
export function dispatch(ext, srcPath, relPath, ctx) {
  for (const handler of _handlers) {
    if (handler.match(ext, srcPath, ctx.entry)) {
      return handler.process(srcPath, relPath, ctx);
    }
  }
  return [];
}

/**
 * 등록된 모든 핸들러 초기화 (테스트 격리용)
 */
export function clearHandlers() {
  _handlers.length = 0;
}

/**
 * 현재 등록된 핸들러 목록 반환 (읽기 전용 복사본)
 * @returns {Array}
 */
export function getHandlers() {
  return [..._handlers];
}
