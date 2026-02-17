import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS, FILE_EXTENSIONS, IGNORE_FILES, IGNORE_DIRS } from '../../config/constants.js';
import { sanitizeSlug, sanitizeDirName, generateTitle, formatFileSize } from './utils.js';
import { getSecurityWarning, shouldWarnFile, IFRAME_SANDBOX } from '../../config/security.js';

export function processMarkdownFile(srcFile, destFile) {
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
}

export function processHtmlFolder(srcDir, destFile, relativePath) {
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
}

export function processHtmlFile(srcFile, docsSubDir, downloadsSubDir, relPath) {
  const entry = path.basename(srcFile);
  const title = generateTitle(entry);
  const downloadPath = `/downloads/${relPath}`;

  fs.copySync(srcFile, path.join(downloadsSubDir, entry), { overwrite: true });

  const mdFile = path.join(docsSubDir, sanitizeSlug(entry) + '.md');
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
}

export function processImageFile(srcFile, relativePath) {
  const filename = path.basename(srcFile);
  const title = generateTitle(filename);
  const downloadPath = `/downloads/${relativePath}`;

  fs.copySync(srcFile, path.join(PATHS.DOWNLOADS, relativePath), { overwrite: true });

  const dirPath = path.dirname(relativePath);
  const mdDest = path.join(PATHS.DOCS, dirPath, sanitizeSlug(filename) + '.md');
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
}

export function processAssetFile(srcFile, relativePath) {
  const filename = path.basename(srcFile);
  const title = generateTitle(filename);
  const ext = path.extname(filename).toLowerCase();
  const downloadPath = `/downloads/${relativePath}`;

  fs.copySync(srcFile, path.join(PATHS.DOWNLOADS, relativePath), { overwrite: true });

  const dirPath = path.dirname(relativePath);
  const mdDest = path.join(PATHS.DOCS, dirPath, sanitizeSlug(filename) + '.md');
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
}

function isHtmlFolder(dirPath) {
  return fs.existsSync(path.join(dirPath, 'index.html'));
}

export function processDirectory(srcDir, docsSubDir, downloadsSubDir, relativePath = '') {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_FILES.includes(entry.name)) continue;

    if (entry.isDirectory() && entry.name.toLowerCase() === 'pwa') {
      console.log('[Prebuild] Ignoring "pwa" directory.');
      continue;
    }

    if (entry.isDirectory() && IGNORE_DIRS.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const safeDirName = sanitizeDirName(entry.name);
      if (isHtmlFolder(srcPath)) {
        const mdFile = path.join(docsSubDir, safeDirName + '.md');
        processHtmlFolder(srcPath, mdFile, relPath);
      } else {
        const nextDocsDir = path.join(docsSubDir, safeDirName);
        const nextDownloadsDir = path.join(downloadsSubDir, entry.name);
        fs.ensureDirSync(nextDocsDir);
        processDirectory(srcPath, nextDocsDir, nextDownloadsDir, relPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const safeFileName = sanitizeSlug(entry.name) + ext;

      if (FILE_EXTENSIONS.MARKDOWN.includes(ext)) {
        processMarkdownFile(srcPath, path.join(docsSubDir, safeFileName));
      } else if (FILE_EXTENSIONS.IMAGE.includes(ext)) {
        processImageFile(srcPath, relPath);
      } else if (FILE_EXTENSIONS.HTML.includes(ext)) {
        processHtmlFile(srcPath, docsSubDir, downloadsSubDir, relPath);
      } else {
        processAssetFile(srcPath, relPath);
      }
    }
  }
}
