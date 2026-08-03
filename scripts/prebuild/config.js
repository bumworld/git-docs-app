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

/** .gitdocs.json 이 존재하지만 읽거나 해석할 수 없을 때 발생 */
export class GitdocsConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitdocsConfigError';
  }
}

// 알려진 설정 키와 기대 타입. unknown 키는 경고만 하고 통과시킨다(향후 버전 호환).
const KNOWN_KEYS = {
  title: 'string',
  description: 'string',
  ignorePatterns: 'string[]',
  sidebarOrder: 'string[]',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateConfig(config, configPath) {
  if (!isPlainObject(config)) {
    throw new GitdocsConfigError(
      `[Prebuild] ${configPath} 최상위 값이 JSON 객체가 아닙니다 (받은 값: ${Array.isArray(config) ? 'array' : config === null ? 'null' : typeof config}).`
    );
  }

  for (const [key, value] of Object.entries(config)) {
    const expected = KNOWN_KEYS[key];
    if (!expected) {
      console.warn(`[Prebuild] ${configPath} 알 수 없는 설정 키 "${key}" — 무시합니다.`);
      continue;
    }
    if (expected === 'string') {
      if (typeof value !== 'string') {
        throw new GitdocsConfigError(
          `[Prebuild] ${configPath} "${key}" 는 문자열이어야 합니다 (받은 타입: ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}).`
        );
      }
    } else if (expected === 'string[]') {
      if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new GitdocsConfigError(
          `[Prebuild] ${configPath} "${key}" 는 문자열 배열이어야 합니다 (빈 배열 허용).`
        );
      }
    }
  }

  return config;
}

/**
 * SOURCE 루트의 .gitdocs.json을 읽어 반환.
 *
 * 파일이 없으면 빈 객체를 반환하지만, 파일이 "존재하는데" 읽기/파싱/검증에 실패하면
 * GitdocsConfigError 를 던져 빌드를 중단한다(fail-closed). 잘못된 설정을 조용히 무시하면
 * ignorePatterns 가 통째로 사라져 비공개 문서가 게시되는 사고로 이어지기 때문이다.
 */
export function loadGitdocsConfig(sourcePath) {
  const configPath = path.join(sourcePath, '.gitdocs.json');
  if (!fs.existsSync(configPath)) return {};

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new GitdocsConfigError(`[Prebuild] ${configPath} 읽기 실패: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new GitdocsConfigError(`[Prebuild] ${configPath} JSON 파싱 실패: ${err.message}`);
  }

  const config = validateConfig(parsed, configPath);
  console.log(`[Prebuild] .gitdocs.json 로드 완료${config.title ? ` — title: "${config.title}"` : ''}`);
  return config;
}
