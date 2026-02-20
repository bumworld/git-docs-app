import fs from 'fs-extra';
import path from 'path';

/**
 * glob 패턴을 RegExp으로 변환
 * - *  → 슬래시 제외 임의 문자
 * - ** → 슬래시 포함 임의 문자
 * - ?  → 슬래시 제외 임의 단일 문자
 */
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\+/g, '\\+')
    .replace(/\^/g, '\\^')
    .replace(/\$/g, '\\$')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|');

  const regexStr = escaped
    .replace(/\*\*/g, '\x00GLOBSTAR\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00GLOBSTAR\x00/g, '.*')
    .replace(/\?/g, '[^/]');

  return new RegExp(`^${regexStr}$`);
}

/**
 * relPath가 ignorePatterns 중 하나에 해당하면 true 반환
 */
export function shouldIgnore(relPath, patterns) {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some(pattern => {
    try {
      return globToRegex(pattern).test(relPath);
    } catch {
      return false;
    }
  });
}

/**
 * SOURCE 루트의 .gitdocs.json을 읽어 반환.
 * 파일이 없거나 파싱 실패 시 빈 객체 반환 (graceful degradation).
 */
export function loadGitdocsConfig(sourcePath) {
  const configPath = path.join(sourcePath, '.gitdocs.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    console.log(`[Prebuild] .gitdocs.json 로드 완료${config.title ? ` — title: "${config.title}"` : ''}`);
    return config;
  } catch (err) {
    console.warn(`[Prebuild] .gitdocs.json 파싱 실패 — 기본 설정 사용: ${err.message}`);
    return {};
  }
}
