import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS, FILE_EXTENSIONS } from '../../config/constants.js';
import { sanitizeSlug, sanitizeDirName, generateTitle } from './utils.js';

function readIndexLabel(indexPath, fallback) {
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const parsed = matter(content);
    if (parsed.data.sidebar?.label) return parsed.data.sidebar.label;
    if (parsed.data.title) return parsed.data.title;
  } catch { /* use fallback */ }
  return fallback;
}

function scanDir(dir, relDir = '') {
  const items = [];
  if (!fs.existsSync(dir)) return items;

  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    // `.` 또는 `_` 프리픽스 파일/디렉토리는 Astro 콘텐츠 컬렉션이 라우트에서 제외하므로
    // 사이드바에도 포함하지 않는다 (존재하지 않는 슬러그 참조로 인한 빌드 실패 방지).
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

    if (entry.isDirectory()) {
      const dirSlug = sanitizeDirName(entry.name).toLowerCase();
      const subRelDir = relDir ? `${relDir}/${dirSlug}` : dirSlug;
      const subDirPath = path.join(dir, entry.name);
      const subItems = scanDir(subDirPath, subRelDir);

      const indexPath = path.join(subDirPath, 'index.md');
      const hasIndex = fs.existsSync(indexPath);
      const dirLabel = generateTitle(entry.name);

      if (hasIndex && subItems.length === 0) {
        // index.md만 있음 → 그룹 없이 리프 아이템으로 평탄화
        items.push({ label: readIndexLabel(indexPath, dirLabel), slug: subRelDir });
      } else if (hasIndex) {
        // index.md + 다른 파일 → 그룹 + 첫 아이템으로 디렉토리 자체 링크
        items.push({
          label: dirLabel,
          collapsed: true,
          items: [
            { label: readIndexLabel(indexPath, dirLabel), slug: subRelDir },
            ...subItems,
          ],
        });
      } else if (subItems.length > 0) {
        items.push({
          label: dirLabel,
          collapsed: true,
          items: subItems,
        });
      }
    } else if (entry.isFile() && FILE_EXTENSIONS.MARKDOWN.includes(path.extname(entry.name).toLowerCase())) {
      // index.md는 디렉토리 처리 분기에서 별도 처리 (루트는 generateSidebarConfig에서 처리)
      if (entry.name === 'index.md') continue;

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

export function generateSidebarConfig(gitdocsConfig = {}) {
  let items = scanDir(PATHS.DOCS);

  // sidebarOrder 적용: 지정된 순서대로 top-level 항목 재정렬, 나머지는 뒤에 유지
  if (gitdocsConfig.sidebarOrder && gitdocsConfig.sidebarOrder.length > 0) {
    const labelToKey = (label) => label.toLowerCase().replace(/\s+/g, '-');
    const order = gitdocsConfig.sidebarOrder;
    const remaining = [...items];
    const ordered = [];

    for (const key of order) {
      const idx = remaining.findIndex(item =>
        item.slug !== undefined
          ? item.slug === key || item.slug.endsWith('/' + key)
          : labelToKey(item.label) === key
      );
      if (idx !== -1) ordered.push(remaining.splice(idx, 1)[0]);
    }
    items = [...ordered, ...remaining];
  }

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
