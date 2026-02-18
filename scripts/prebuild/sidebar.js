import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS, FILE_EXTENSIONS } from '../../config/constants.js';
import { sanitizeSlug, generateTitle } from './utils.js';

function scanDir(dir, relDir = '') {
  const items = [];
  if (!fs.existsSync(dir)) return items;

  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      const dirSlug = entry.name.toLowerCase();
      const subItems = scanDir(
        path.join(dir, entry.name),
        relDir ? `${relDir}/${dirSlug}` : dirSlug
      );
      if (subItems.length > 0) {
        items.push({
          label: generateTitle(entry.name),
          collapsed: true,
          items: subItems,
        });
      }
    } else if (entry.isFile() && FILE_EXTENSIONS.MARKDOWN.includes(path.extname(entry.name).toLowerCase())) {
      if (entry.name === 'index.md' && relDir === '') continue; // generateSidebarConfig에서 별도 처리

      const rawSlug = relDir
        ? `${relDir}/${sanitizeSlug(entry.name)}`
        : sanitizeSlug(entry.name);
      const slug = rawSlug.toLowerCase();

      let label = generateTitle(entry.name);
      try {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        const parsed = matter(content);
        if (parsed.data.sidebar?.label) {
          label = parsed.data.sidebar.label;
        } else if (parsed.data.title) {
          label = parsed.data.title;
        }
      } catch { /* use default label */ }

      items.push({ label, slug });
    }
  }
  return items;
}

export function generateSidebarConfig() {
  const items = scanDir(PATHS.DOCS);

  // 루트 index.md (README.md에서 변환된)를 사이드바 첫 번째 항목으로 추가
  // slug ''는 Starlight의 홈 페이지 슬러그
  const indexPath = path.join(PATHS.DOCS, 'index.md');
  if (fs.existsSync(indexPath)) {
    let label = 'README';
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const parsed = matter(content);
      if (parsed.data.sidebar?.label) label = parsed.data.sidebar.label;
      else if (parsed.data.title) label = parsed.data.title;
    } catch { /* use default label */ }
    items.unshift({ label, slug: '' });
  }

  fs.outputFileSync(PATHS.SIDEBAR_JSON, JSON.stringify(items, null, 2), 'utf-8');
  console.log(`[Prebuild] Sidebar config generated (${items.length} top-level items)`);
}
