import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS, FILE_EXTENSIONS, IGNORE_FILES, IGNORE_DIRS, DIR_CONVENTIONS } from '../../config/constants.js';
import { sanitizeSlug, sanitizeDirName, generateTitle, formatFileSize } from './utils.js';
import { getSecurityWarning, IFRAME_SANDBOX } from '../../config/security.js';
import { getFileStat } from './cache.js';
import { shouldIgnore } from './config.js';
import { register, dispatch } from './registry.js';

// ─── Stats ────────────────────────────────────────────────────────────────────

export function createStats() {
  return {
    processed: 0,
    skipped: 0,
    errors: [],
    byType: { markdown: 0, html: 0, image: 0, asset: 0, textNoExt: 0, static: 0 },
    largeFiles: [],   // 1MB 이상
    longPaths: [],    // 경로 200자 이상
    collisions: [],   // 출력 경로 충돌
    usedPaths: new Set(),
  };
}

// ─── Detection helpers ────────────────────────────────────────────────────────

export function isHtmlFolder(dirPath) {
  return fs.existsSync(path.join(dirPath, 'index.html'));
}

// 진짜 확장자인지 확인: 영숫자만, 공백 없음, 10자 이하
export function isNoExtension(ext) {
  if (ext === '') return true;
  return !/^(\.[a-zA-Z0-9]{1,10})$/.test(ext);
}

export function isLikelyText(filePath) {
  try {
    const SAMPLE_BYTES = 512;
    const buf = Buffer.alloc(SAMPLE_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, SAMPLE_BYTES, 0);
    fs.closeSync(fd);

    const sample = buf.slice(0, bytesRead);
    if (sample.includes(0x00)) return false;

    const text = sample.toString('utf-8');
    const lines = text.split('\n').slice(0, 10).join('\n');
    const controlChars = lines.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    }).length;

    return controlChars / Math.max(lines.length, 1) < 0.1;
  } catch {
    return false;
  }
}

// MDX 파서가 깨지는 ${...}, {블록} 패턴이 있으면 마크다운이 아닌 것으로 판단
export function isLikelyMarkdown(filePath) {
  try {
    const SAMPLE_BYTES = 1024;
    const buf = Buffer.alloc(SAMPLE_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, SAMPLE_BYTES, 0);
    fs.closeSync(fd);

    const text = buf.slice(0, bytesRead).toString('utf-8');
    const lines = text.split('\n').slice(0, 15);
    const firstLine = lines[0].trim();

    if (firstLine === '---') return true;
    if (/^#{1,6} /.test(firstLine)) return true;
    if (/^[-*] /.test(firstLine)) return true;

    if (firstLine.startsWith('#!')) return false;
    if (/^pipeline\s*\{/.test(firstLine)) return false;
    if (/^(stage|stages|steps|agent|environment)\s*[\({]/.test(firstLine)) return false;

    const sampleText = lines.join('\n');
    const jsxBreakers = (sampleText.match(/\$\{|^\s*\w+\s*\{|^\s*if\s*\(|^\s*def\s+\w+/mg) || []).length;
    if (jsxBreakers >= 2) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// destPath 가 이미 사용 중이면 충돌을 기록하고 false 반환, 아니면 등록 후 true 반환
export function registerPath(destPath, relPath, label, stats) {
  if (stats?.usedPaths?.has(destPath)) {
    console.warn(`[Prebuild] 경로 충돌 (${label} 건너뜀): ${relPath} → ${destPath} 이미 사용됨`);
    if (stats) { stats.skipped++; stats.collisions.push({ src: relPath, dest: destPath }); }
    return false;
  }
  if (stats?.usedPaths) stats.usedPaths.add(destPath);
  return true;
}

// 텍스트 파일 내용을 읽어 마크다운 코드블록 문자열로 반환 (20KB 초과 시 앞부분만 표시)
function readTextPreview(srcFile, ext) {
  const MAX_SIZE_BYTES = 20 * 1024;
  const PREVIEW_SIZE_BYTES = 5 * 1024;
  const fileSizeBytes = fs.statSync(srcFile).size;

  let fileContent = fs.readFileSync(srcFile, 'utf-8');
  let isTruncated = false;

  if (fileSizeBytes > MAX_SIZE_BYTES) {
    const maxChars = Math.floor(PREVIEW_SIZE_BYTES / 2);
    if (fileContent.length > maxChars) {
      fileContent = fileContent.substring(0, maxChars);
      isTruncated = true;
    }
  }

  const languageMap = {
    '.json': 'json', '.sql': 'sql', '.xml': 'xml',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.ini': 'ini', '.conf': 'ini', '.config': 'ini',
    '.properties': 'properties',
    '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
    '.toml': 'toml', '.csv': 'csv',
    '.env': 'bash', '.gitignore': 'txt',
  };
  const language = languageMap[ext] || 'txt';
  const truncatedNote = isTruncated
    ? `\n\n... *(파일 내용이 더 있습니다. 전체 내용을 보려면 위의 다운로드 링크를 사용하세요.)*\n`
    : '';

  return `\n\`\`\`${language}\n${fileContent}\n\`\`\`${truncatedNote}`;
}

// ─── File processors ──────────────────────────────────────────────────────────

function findImageClose(content, openParen) {
  let depth = 1;
  let quote = null;
  for (let i = openParen + 1; i < content.length; i++) {
    const char = content[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

function parseImageDestination(inner) {
  const leadingLength = inner.length - inner.trimStart().length;
  const start = leadingLength;
  if (inner[start] === '<') {
    for (let i = start + 1; i < inner.length; i++) {
      if (inner[i] === '\\') i++;
      else if (inner[i] === '>') {
        return { start: start + 1, end: i, angleWrapped: true };
      }
    }
    return null;
  }

  let depth = 0;
  for (let i = start; i < inner.length; i++) {
    const char = inner[i];
    if (char === '\\') {
      i++;
    } else if (/\s/.test(char) && depth === 0) {
      return { start, end: i, angleWrapped: false };
    } else if (char === '(') {
      depth++;
    } else if (char === ')' && depth > 0) {
      depth--;
    }
  }
  return { start, end: inner.length, angleWrapped: false };
}

function rewriteImageDestination(destination, srcFile) {
  if (!destination || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(destination)) return null;

  const suffixIndex = destination.search(/[?#]/);
  const pathname = suffixIndex === -1 ? destination : destination.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : destination.slice(suffixIndex);
  const sourceRoot = path.resolve(PATHS.SOURCE);
  const target = path.resolve(path.dirname(srcFile), pathname);
  if (target !== sourceRoot && !target.startsWith(sourceRoot + path.sep)) return null;

  const relativeTarget = path.relative(sourceRoot, target).split(path.sep).join('/');
  return path.posix.join('/downloads', relativeTarget) + suffix;
}

export function rewriteLocalImagePaths(content, srcFile) {
  let result = '';
  let cursor = 0;

  while (cursor < content.length) {
    const imageStart = content.indexOf('![', cursor);
    if (imageStart === -1) break;
    const destinationOpen = content.indexOf('](', imageStart + 2);
    if (destinationOpen === -1) break;
    const openParen = destinationOpen + 1;
    const closeParen = findImageClose(content, openParen);
    if (closeParen === -1) break;

    const inner = content.slice(openParen + 1, closeParen);
    const parsed = parseImageDestination(inner);
    const rewritten = parsed
      ? rewriteImageDestination(inner.slice(parsed.start, parsed.end), srcFile)
      : null;

    result += content.slice(cursor, openParen + 1);
    if (rewritten) {
      result += inner.slice(0, parsed.start) + rewritten + inner.slice(parsed.end);
    } else {
      result += inner;
    }
    result += ')';
    cursor = closeParen + 1;
  }

  return result + content.slice(cursor);
}

export function processMarkdownFile(srcFile, destFile, stats) {
  try {
    const content = rewriteLocalImagePaths(fs.readFileSync(srcFile, 'utf-8'), srcFile);
    try {
      const parsed = matter(content);
      if (!parsed.data.title) {
        parsed.data.title = generateTitle(path.basename(srcFile));
      }
      if (!parsed.data.sidebar) {
        parsed.data.sidebar = { label: parsed.data.title };
      }
      fs.outputFileSync(destFile, matter.stringify(parsed.content, parsed.data), 'utf-8');
    } catch {
      const title = generateTitle(path.basename(srcFile));
      const frontmatter = `---\ntitle: "${title}"\nsidebar:\n  label: "${title}"\n---\n\n`;
      fs.outputFileSync(destFile, frontmatter + content, 'utf-8');
    }
    if (stats) { stats.processed++; stats.byType.markdown++; }
    return [destFile];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] Error processing ${srcFile}: ${err.message}`);
    return [];
  }
}

export function processHtmlFolder(srcDir, destFile, relativePath, stats) {
  try {
    const indexFile = path.join(srcDir, 'index.html');
    if (!fs.existsSync(indexFile)) return [];

    const title = generateTitle(path.basename(srcDir));
    const downloadPath = `/downloads/${relativePath}/`;

    fs.copySync(srcDir, path.join(PATHS.DOWNLOADS, relativePath), { overwrite: true });

    const mdContent = `---
title: "${title}"
sidebar:
  label: "${title}"
---

:::caution[Security Notice]
This HTML application is displayed in a sandboxed iframe. Scripts may be restricted for security.
:::

<a href="${downloadPath}index.html" target="_blank" rel="noopener noreferrer">🔗 Open in new window</a>

<iframe src="${downloadPath}index.html" sandbox="${IFRAME_SANDBOX}" style="width:100%;height:80vh;border:none;"></iframe>
`;
    fs.outputFileSync(destFile, mdContent, 'utf-8');
    if (stats) { stats.processed++; stats.byType.html++; }
    return [destFile];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcDir, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcDir} → ${err.message}`);
    return [];
  }
}

export function processHtmlFile(srcFile, docsSubDir, downloadsSubDir, relPath, stats) {
  try {
    const entry = path.basename(srcFile);
    const title = generateTitle(entry);
    const downloadPath = `/downloads/${relPath}`;
    const downloadDest = path.join(downloadsSubDir, entry);

    fs.copySync(srcFile, downloadDest, { overwrite: true });

    const mdFile = path.join(docsSubDir, sanitizeSlug(entry).toLowerCase() + '.md');
    const mdContent = `---
title: "${title}"
sidebar:
  label: "${title}"
---

:::caution[Security Notice]
This HTML file is displayed in a sandboxed iframe. Scripts may be restricted for security.
:::

<a href="${downloadPath}" target="_blank" rel="noopener noreferrer">🔗 Open in new window</a>

<iframe src="${downloadPath}" sandbox="${IFRAME_SANDBOX}" style="width:100%;height:80vh;border:none;"></iframe>
`;
    fs.outputFileSync(mdFile, mdContent, 'utf-8');
    if (stats) { stats.processed++; stats.byType.html++; }
    return [mdFile, downloadDest];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
    return [];
  }
}

export function processImageFile(srcFile, relativePath, stats) {
  try {
    const filename = path.basename(srcFile);
    const title = generateTitle(filename);
    const downloadPath = `/downloads/${relativePath}`;
    const downloadDest = path.join(PATHS.DOWNLOADS, relativePath);

    fs.copySync(srcFile, downloadDest, { overwrite: true });

    const dirPath = path.dirname(relativePath);
    const mdDest = path.join(PATHS.DOCS, dirPath, sanitizeSlug(filename).toLowerCase() + '.md');
    const sizeStr = formatFileSize(fs.statSync(srcFile).size);

    const mdContent = `---
title: "${title}"
sidebar:
  label: "🖼 ${title}"
---

<a href="${downloadPath}" target="_blank" rel="noopener noreferrer">🔗 Open in new tab</a> · <a href="${downloadPath}" download>📥 Download</a> · <span style="color:var(--sl-color-gray-3);">${sizeStr}</span>

<a href="${downloadPath}" target="_blank" rel="noopener noreferrer"><img src="${downloadPath}" alt="${title}" style="max-width:100%;border:1px solid var(--sl-color-gray-5);border-radius:8px;margin-top:0.5rem;" /></a>
`;
    fs.outputFileSync(mdDest, mdContent, 'utf-8');
    if (stats) { stats.processed++; stats.byType.image++; }
    return [mdDest, downloadDest];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
    return [];
  }
}

export function processAssetFile(srcFile, relativePath, docsSubDir, stats) {
  try {
    const filename = path.basename(srcFile);
    const title = generateTitle(filename);
    const ext = path.extname(filename).toLowerCase();
    const downloadPath = `/downloads/${relativePath}`;
    const downloadDest = path.join(PATHS.DOWNLOADS, relativePath);

    fs.copySync(srcFile, downloadDest, { overwrite: true });

    const mdDest = path.join(docsSubDir, sanitizeSlug(filename).toLowerCase() + '.md');
    const sizeStr = formatFileSize(fs.statSync(srcFile).size);

    const securityWarning = getSecurityWarning(filename);
    const warningSection = securityWarning ? `\n:::danger[Security Warning]\n${securityWarning}\n:::\n\n` : '\n';

    let contentSection = '';
    if (FILE_EXTENSIONS.TEXT.includes(ext)) {
      try {
        contentSection = readTextPreview(srcFile, ext);
      } catch (error) {
        console.error(`[Prebuild] Failed to read text file ${srcFile}:`, error.message);
      }
    }

    const mdContent = `---
title: "${title}"
sidebar:
  label: "📎 ${title}"
---
${warningSection}**File:** ${filename}
**Size:** ${sizeStr}
**Type:** ${ext || 'unknown'}

<a href="${downloadPath}" download>📥 Download ${filename}</a>
${contentSection}`;
    fs.outputFileSync(mdDest, mdContent, 'utf-8');
    if (stats) { stats.processed++; stats.byType.asset++; }
    return [mdDest, downloadDest];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
    return [];
  }
}

export function processTextNoExtFile(srcFile, destFile, stats) {
  try {
    const filename = path.basename(srcFile);
    const title = generateTitle(filename);
    const fileSize = fs.statSync(srcFile).size;
    const MAX_SIZE_BYTES = 20 * 1024;
    const PREVIEW_SIZE_BYTES = 5 * 1024;

    let content = fs.readFileSync(srcFile, 'utf-8');
    let isTruncated = false;
    if (fileSize > MAX_SIZE_BYTES) {
      const maxChars = Math.floor(PREVIEW_SIZE_BYTES / 2);
      if (content.length > maxChars) {
        content = content.substring(0, maxChars);
        isTruncated = true;
      }
    }

    const truncatedNote = isTruncated ? `\n\n*... (파일이 길어 일부만 표시됩니다)*` : '';

    const mdContent = `---
title: "${title}"
sidebar:
  label: "${title}"
---

\`\`\`
${content}
\`\`\`${truncatedNote}
`;
    fs.outputFileSync(destFile, mdContent, 'utf-8');
    if (stats) { stats.processed++; stats.byType.asset++; }
    return [destFile];
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] Error processing ${srcFile}: ${err.message}`);
    return [];
  }
}

// __static / __raw 디렉토리: docs 페이지 생성 없이 downloads 경로에만 파일을 복사한다.
// label 파라미터는 로그 메시지 구분용 (__static 또는 __raw).
export function processStaticContents(srcDir, destDir, relPath, stats, label = '__static') {
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (err) {
    if (stats) stats.errors.push({ file: srcDir, message: err.message });
    console.error(`[Prebuild] ${label} 디렉토리 읽기 실패: ${srcDir} → ${err.message}`);
    return [];
  }

  const destFiles = [];
  for (const entry of entries) {
    if (IGNORE_FILES.includes(entry.name)) continue;
    const entrySrc = path.join(srcDir, entry.name);
    const entryDest = path.join(destDir, entry.name);
    const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
    try {
      fs.copySync(entrySrc, entryDest, { overwrite: true });
      destFiles.push(entryDest);
      if (stats) { stats.processed++; stats.byType.static++; }
      console.log(`[Prebuild] ${label} 복사: ${entryRelPath} → ${entryDest}`);
    } catch (err) {
      if (stats) stats.errors.push({ file: entryRelPath, message: err.message });
      console.error(`[Prebuild] ${label} 복사 실패: ${entryRelPath} → ${err.message}`);
    }
  }
  return destFiles;
}

// ─── Directory traversal ──────────────────────────────────────────────────────

export function processDirectory(srcDir, docsSubDir, downloadsSubDir, relativePath = '', stats = null, cacheCtx = null, gitdocsConfig = {}) {
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (err) {
    if (stats) stats.errors.push({ file: srcDir, message: `디렉토리 읽기 실패: ${err.message}` });
    console.error(`[Prebuild] Error reading directory ${srcDir}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    if (IGNORE_FILES.includes(entry.name)) continue;
    if (entry.name.startsWith('.')) continue; // 닷 프리픽스 파일/디렉토리 무시 (.gitdocs.json 등)
    // `_` 프리픽스 파일/디렉토리는 Astro 콘텐츠 컬렉션이 라우트에서 제외하므로 docs로 복사하지 않는다.
    // 단, __static/__raw/__ignore 등 특수 디렉토리 컨벤션은 아래에서 별도 처리하므로 예외로 둔다.
    // (예외는 디렉토리에만 적용 — 같은 이름의 확장자 없는 파일은 일반 `_` 규칙으로 제외)
    const isConventionDir = entry.isDirectory() && Object.values(DIR_CONVENTIONS).includes(entry.name);
    if (entry.name.startsWith('_') && !isConventionDir) {
      if (stats) stats.skipped++;
      continue;
    }

    if (entry.isDirectory() && entry.name.toLowerCase() === 'pwa') {
      console.log('[Prebuild] Ignoring "pwa" directory.');
      if (stats) stats.skipped++;
      continue;
    }

    if (entry.isDirectory() && IGNORE_DIRS.includes(entry.name)) {
      if (stats) stats.skipped++;
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const entryName = entry.name.normalize('NFC');  // macOS NFD(자모 분리) → NFC 정규화
    const relPath = relativePath ? `${relativePath}/${entryName}` : entryName;

    // .gitdocs.json ignorePatterns 체크
    if (shouldIgnore(relPath, gitdocsConfig.ignorePatterns)) {
      if (stats) stats.skipped++;
      continue;
    }

    if (entry.isDirectory()) {
      // __ignore: 완전 무시 (docs도 downloads도 생성 안 함)
      if (entry.name === DIR_CONVENTIONS.IGNORE) {
        if (stats) stats.skipped++;
        continue;
      }

      // __static: downloads에만 복사, 폴더명 URL 제외
      // 예) source/__static/data/foo.json → /downloads/data/foo.json
      if (entry.name === DIR_CONVENTIONS.STATIC) {
        const destFiles = processStaticContents(srcPath, downloadsSubDir, relPath, stats, DIR_CONVENTIONS.STATIC);
        if (cacheCtx) {
          cacheCtx.newEntries[relPath] = { mtime: 0, size: 0, destFiles };
        }
        continue;
      }

      // __raw: downloads에만 복사, 폴더명 URL 포함
      // 예) source/__raw/assets/img.png → /downloads/__raw/assets/img.png
      if (entry.name === DIR_CONVENTIONS.RAW) {
        const nextDownloadsDir = path.join(downloadsSubDir, entry.name);
        const destFiles = processStaticContents(srcPath, nextDownloadsDir, relPath, stats, DIR_CONVENTIONS.RAW);
        if (cacheCtx) {
          cacheCtx.newEntries[relPath] = { mtime: 0, size: 0, destFiles };
        }
        continue;
      }

      const safeDirName = sanitizeDirName(entry.name).toLowerCase();
      if (isHtmlFolder(srcPath)) {
        const mdFile = path.join(docsSubDir, safeDirName + '.md');
        if (registerPath(mdFile, relPath, '폴더', stats)) {
          const destFiles = processHtmlFolder(srcPath, mdFile, relPath, stats);
          if (cacheCtx) {
            cacheCtx.newEntries[relPath] = { mtime: 0, size: 0, destFiles };
          }
        }
      } else {
        const nextDocsDir = path.join(docsSubDir, safeDirName);
        const nextDownloadsDir = path.join(downloadsSubDir, entry.name);
        // 폴더 안에 index.md가 있으면 같은 이름 파일과 Astro 슬러그 충돌 발생
        const conflictPath = path.join(docsSubDir, safeDirName + '.md');
        if (stats?.usedPaths?.has(conflictPath) && fs.existsSync(path.join(srcPath, 'index.md'))) {
          console.warn(`[Prebuild] 슬러그 충돌 경고: "${relPath}/index.md" 와 "${relPath}.md" 가 같은 Astro 슬러그를 가집니다. 소스 구조를 확인하세요.`);
          if (stats) stats.collisions.push({ src: `${relPath}/index.md`, dest: conflictPath });
        }
        fs.ensureDirSync(nextDocsDir);
        processDirectory(srcPath, nextDocsDir, nextDownloadsDir, relPath, stats, cacheCtx, gitdocsConfig);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const safeFileName = sanitizeSlug(entry.name).toLowerCase() + ext;

      // 증분 빌드: mtime + size 기반 캐시 체크 (일반 파일만)
      const fileStat = cacheCtx ? getFileStat(srcPath) : null;
      if (cacheCtx && fileStat) {
        const cached = cacheCtx.cache[relPath];
        if (
          cached &&
          cached.mtime === fileStat.mtime &&
          cached.size === fileStat.size &&
          (cached.destFiles || []).length > 0 &&
          (cached.destFiles || []).every(f => fs.existsSync(f))
        ) {
          cacheCtx.newEntries[relPath] = cached;
          if (stats) stats.skipped++;
          continue;
        }
      }

      // 대용량 파일 감지 (1MB 이상)
      try {
        const fileSize = fileStat ? fileStat.size : fs.statSync(srcPath).size;
        if (stats && fileSize > 1024 * 1024) stats.largeFiles.push({ file: relPath, size: fileSize });
      } catch { /* ignore */ }

      // 경로 길이 감지 (200자 이상)
      if (stats && relPath.length > 200) stats.longPaths.push(relPath);

      try {
        let destFiles = [];
        {
          const ctx = { docsSubDir, downloadsSubDir, stats, safeFileName, entry };
          destFiles = dispatch(ext, srcPath, relPath, ctx);
        }

        if (cacheCtx && fileStat) {
          cacheCtx.newEntries[relPath] = { ...fileStat, destFiles };
        }
      } catch (err) {
        if (stats) stats.errors.push({ file: relPath, message: err.message });
        console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${relPath} → ${err.message}`);
      }
    }
  }
}

// ─── Default handler registration ────────────────────────────────────────────
// processDirectory()의 dispatch()가 사용할 기본 핸들러 등록.
// 등록 순서 = 매칭 우선순위 (먼저 등록한 핸들러가 우선).
// asset은 fallback으로 항상 마지막에 등록.

register({
  name: 'markdown',
  match: (ext) => FILE_EXTENSIONS.MARKDOWN.includes(ext),
  process: (srcPath, relPath, ctx) => {
    const destPath = path.join(ctx.docsSubDir, ctx.safeFileName);
    if (registerPath(destPath, relPath, '파일', ctx.stats)) {
      return processMarkdownFile(srcPath, destPath, ctx.stats);
    }
    return [];
  },
});

register({
  name: 'image',
  match: (ext) => FILE_EXTENSIONS.IMAGE.includes(ext),
  process: (srcPath, relPath, ctx) => processImageFile(srcPath, relPath, ctx.stats),
});

register({
  name: 'html',
  match: (ext) => FILE_EXTENSIONS.HTML.includes(ext),
  process: (srcPath, relPath, ctx) =>
    processHtmlFile(srcPath, ctx.docsSubDir, ctx.downloadsSubDir, relPath, ctx.stats),
});

register({
  name: 'textNoExt',
  match: (ext, srcPath) => isNoExtension(ext) && isLikelyText(srcPath),
  process: (srcPath, relPath, ctx) => {
    const destPath = path.join(ctx.docsSubDir, sanitizeSlug(ctx.entry.name).toLowerCase() + '.md');
    if (ctx.stats) ctx.stats.byType.textNoExt++;
    if (registerPath(destPath, relPath, '파일', ctx.stats)) {
      return isLikelyMarkdown(srcPath)
        ? processMarkdownFile(srcPath, destPath, ctx.stats)
        : processTextNoExtFile(srcPath, destPath, ctx.stats);
    }
    return [];
  },
});

register({
  name: 'asset',
  match: () => true,  // fallback: 위 핸들러에서 매칭되지 않은 모든 파일
  process: (srcPath, relPath, ctx) => processAssetFile(srcPath, relPath, ctx.docsSubDir, ctx.stats),
});
