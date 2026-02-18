import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS, FILE_EXTENSIONS, IGNORE_FILES, IGNORE_DIRS } from '../../config/constants.js';
import { sanitizeSlug, sanitizeDirName, generateTitle, formatFileSize } from './utils.js';
import { getSecurityWarning, shouldWarnFile, IFRAME_SANDBOX } from '../../config/security.js';

export function createStats() {
  return {
    processed: 0,
    skipped: 0,
    errors: [],
    byType: { markdown: 0, html: 0, image: 0, asset: 0, textNoExt: 0 },
    largeFiles: [],    // 1MB 이상
    longPaths: [],     // 경로 200자 이상
    collisions: [],    // 출력 경로 충돌
    usedPaths: new Set(), // 출력 경로 중복 추적
  };
}

export function processMarkdownFile(srcFile, destFile, stats) {
  try {
    const content = fs.readFileSync(srcFile, 'utf-8');
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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] Error processing ${srcFile}: ${err.message}`);
  }
}

export function processHtmlFolder(srcDir, destFile, relativePath, stats) {
  try {
    const indexFile = path.join(srcDir, 'index.html');
    if (!fs.existsSync(indexFile)) return;

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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcDir, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcDir} → ${err.message}`);
  }
}

export function processHtmlFile(srcFile, docsSubDir, downloadsSubDir, relPath, stats) {
  try {
    const entry = path.basename(srcFile);
    const title = generateTitle(entry);
    const downloadPath = `/downloads/${relPath}`;

    fs.copySync(srcFile, path.join(downloadsSubDir, entry), { overwrite: true });

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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
  }
}

export function processImageFile(srcFile, relativePath, stats) {
  try {
    const filename = path.basename(srcFile);
    const title = generateTitle(filename);
    const downloadPath = `/downloads/${relativePath}`;

    fs.copySync(srcFile, path.join(PATHS.DOWNLOADS, relativePath), { overwrite: true });

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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
  }
}

export function processAssetFile(srcFile, relativePath, stats) {
  try {
  const filename = path.basename(srcFile);
  const title = generateTitle(filename);
  const ext = path.extname(filename).toLowerCase();
  const downloadPath = `/downloads/${relativePath}`;

  fs.copySync(srcFile, path.join(PATHS.DOWNLOADS, relativePath), { overwrite: true });

  const dirPath = path.dirname(relativePath);
  const mdDest = path.join(PATHS.DOCS, dirPath, sanitizeSlug(filename).toLowerCase() + '.md');
  const sizeStr = formatFileSize(fs.statSync(srcFile).size);

  // Get security warning if applicable
  const securityWarning = getSecurityWarning(filename);
  const warningSection = securityWarning ? `\n:::danger[Security Warning]\n${securityWarning}\n:::\n\n` : '\n';

  // Check if it's a text file and read its content
  let contentSection = '';
  if (FILE_EXTENSIONS.TEXT.includes(ext)) {
    try {
      const fileStats = fs.statSync(srcFile);
      const fileSizeBytes = fileStats.size;
      const MAX_SIZE_BYTES = 20 * 1024; // 20KB
      const PREVIEW_SIZE_BYTES = 5 * 1024; // 5KB

      let fileContent = fs.readFileSync(srcFile, 'utf-8');
      let isTruncated = false;

      // If file is larger than 20KB, show only first ~5KB
      if (fileSizeBytes > MAX_SIZE_BYTES) {
        // Truncate by character count to avoid breaking UTF-8 characters
        const maxChars = Math.floor(PREVIEW_SIZE_BYTES / 2); // Rough estimate for multi-byte chars
        if (fileContent.length > maxChars) {
          fileContent = fileContent.substring(0, maxChars);
          isTruncated = true;
        }
      }

      // Map file extensions to code block language
      const languageMap = {
        '.json': 'json',
        '.sql': 'sql',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.ini': 'ini',
        '.conf': 'ini',
        '.config': 'ini',
        '.properties': 'properties',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'bash',
        '.toml': 'toml',
        '.csv': 'csv',
        '.env': 'bash',
        '.gitignore': 'txt',
      };
      const language = languageMap[ext] || 'txt';

      const truncatedNote = isTruncated
        ? `\n\n... *(파일 내용이 더 있습니다. 전체 내용을 보려면 위의 다운로드 링크를 사용하세요.)*\n`
        : '';

      contentSection = `\n\`\`\`${language}\n${fileContent}\n\`\`\`${truncatedNote}`;
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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${srcFile} → ${err.message}`);
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

    const truncatedNote = isTruncated
      ? `\n\n*... (파일이 길어 일부만 표시됩니다)*`
      : '';

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
  } catch (err) {
    if (stats) stats.errors.push({ file: srcFile, message: err.message });
    console.error(`[Prebuild] Error processing ${srcFile}: ${err.message}`);
  }
}

// 진짜 확장자인지 확인: 영숫자만, 공백 없음, 10자 이하
function isNoExtension(ext) {
  if (ext === '') return true;
  return !/^(\.[a-zA-Z0-9]{1,10})$/.test(ext);
}

function isLikelyText(filePath) {
  try {
    const SAMPLE_BYTES = 512;
    const buf = Buffer.alloc(SAMPLE_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, SAMPLE_BYTES, 0);
    fs.closeSync(fd);

    const sample = buf.slice(0, bytesRead);

    // null 바이트가 있으면 바이너리로 판단
    if (sample.includes(0x00)) return false;

    // UTF-8로 디코딩해서 첫 10줄 읽기
    const text = sample.toString('utf-8');
    const lines = text.split('\n').slice(0, 10).join('\n');

    // 제어문자(탭·개행 제외)가 10% 이상이면 바이너리로 판단
    const controlChars = lines.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    }).length;

    return controlChars / Math.max(lines.length, 1) < 0.1;
  } catch {
    return false;
  }
}

// 마크다운 문서인지 판단 (스크립트/코드 파일과 구분)
// MDX 파서가 깨지는 ${...}, {블록} 패턴이 있으면 마크다운이 아닌 것으로 판단
function isLikelyMarkdown(filePath) {
  try {
    const SAMPLE_BYTES = 1024;
    const buf = Buffer.alloc(SAMPLE_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, SAMPLE_BYTES, 0);
    fs.closeSync(fd);

    const text = buf.slice(0, bytesRead).toString('utf-8');
    const lines = text.split('\n').slice(0, 15);
    const firstLine = lines[0].trim();

    // 명확한 마크다운 시작 패턴
    if (firstLine === '---') return true;              // frontmatter
    if (/^#{1,6} /.test(firstLine)) return true;      // # 제목
    if (/^[-*] /.test(firstLine)) return true;         // 리스트

    // 명확한 스크립트/코드 패턴 → 마크다운 아님
    if (firstLine.startsWith('#!')) return false;       // shebang
    if (/^pipeline\s*\{/.test(firstLine)) return false; // Jenkinsfile
    if (/^(stage|stages|steps|agent|environment)\s*[\({]/.test(firstLine)) return false;

    // MDX 파서를 깨뜨리는 패턴이 초반에 많으면 스크립트로 판단
    const sampleText = lines.join('\n');
    const jsxBreakers = (sampleText.match(/\$\{|^\s*\w+\s*\{|^\s*if\s*\(|^\s*def\s+\w+/mg) || []).length;
    if (jsxBreakers >= 2) return false;

    return true;
  } catch {
    return false;
  }
}

function isHtmlFolder(dirPath) {
  return fs.existsSync(path.join(dirPath, 'index.html'));
}

export function processDirectory(srcDir, docsSubDir, downloadsSubDir, relativePath = '', stats = null) {
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
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const safeDirName = sanitizeDirName(entry.name).toLowerCase();
      if (isHtmlFolder(srcPath)) {
        const mdFile = path.join(docsSubDir, safeDirName + '.md');
        // 파일명과 폴더명 충돌: 같은 이름의 .md가 이미 있으면 경고
        if (stats?.usedPaths?.has(mdFile)) {
          console.warn(`[Prebuild] 경로 충돌 (폴더 건너뜀): ${relPath} → ${mdFile} 이미 사용됨`);
          if (stats) { stats.skipped++; stats.collisions.push({ src: relPath, dest: mdFile }); }
        } else {
          if (stats?.usedPaths) stats.usedPaths.add(mdFile);
          processHtmlFolder(srcPath, mdFile, relPath, stats);
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
        processDirectory(srcPath, nextDocsDir, nextDownloadsDir, relPath, stats);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const safeFileName = sanitizeSlug(entry.name).toLowerCase() + ext;

      // 대용량 파일 감지 (1MB 이상)
      try {
        const fileSize = fs.statSync(srcPath).size;
        if (stats && fileSize > 1024 * 1024) {
          stats.largeFiles.push({ file: relPath, size: fileSize });
        }
      } catch { /* ignore */ }

      // 경로 길이 감지 (200자 이상)
      if (stats && relPath.length > 200) {
        stats.longPaths.push(relPath);
      }

      try {
        if (FILE_EXTENSIONS.MARKDOWN.includes(ext)) {
          const destPath = path.join(docsSubDir, safeFileName);
          if (stats?.usedPaths?.has(destPath)) {
            console.warn(`[Prebuild] 경로 충돌 (파일 건너뜀): ${relPath} → ${destPath} 이미 사용됨`);
            if (stats) { stats.skipped++; stats.collisions.push({ src: relPath, dest: destPath }); }
          } else {
            if (stats?.usedPaths) stats.usedPaths.add(destPath);
            processMarkdownFile(srcPath, destPath, stats);
          }
        } else if (FILE_EXTENSIONS.IMAGE.includes(ext)) {
          processImageFile(srcPath, relPath, stats);
        } else if (FILE_EXTENSIONS.HTML.includes(ext)) {
          processHtmlFile(srcPath, docsSubDir, downloadsSubDir, relPath, stats);
        } else if (isNoExtension(ext) && isLikelyText(srcPath)) {
          if (stats) stats.byType.textNoExt++;
          const destPath = path.join(docsSubDir, sanitizeSlug(entry.name).toLowerCase() + '.md');
          if (stats?.usedPaths?.has(destPath)) {
            console.warn(`[Prebuild] 경로 충돌 (파일 건너뜀): ${relPath} → ${destPath} 이미 사용됨`);
            if (stats) { stats.skipped++; stats.collisions.push({ src: relPath, dest: destPath }); }
          } else {
            if (stats?.usedPaths) stats.usedPaths.add(destPath);
            if (isLikelyMarkdown(srcPath)) {
              processMarkdownFile(srcPath, destPath, stats);
            } else {
              processTextNoExtFile(srcPath, destPath, stats);
            }
          }
        } else {
          processAssetFile(srcPath, relPath, stats);
        }
      } catch (err) {
        if (stats) stats.errors.push({ file: relPath, message: err.message });
        console.error(`[Prebuild] 파일 처리 실패, 건너뜀: ${relPath} → ${err.message}`);
      }
    }
  }
}
