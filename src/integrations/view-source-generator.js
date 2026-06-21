import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { PATHS } from '../../config/constants.js';

/**
 * Astro integration to generate source JSON files after build
 */
export function viewSourceGenerator() {
  return {
    name: 'view-source-generator',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        console.log('[ViewSource] Generating source JSON files...');

        const distDir = dir.pathname;
        const sourcesDir = path.join(distDir, '_sources');
        const docsDir = PATHS.DOCS;
        const sourceDir = PATHS.SOURCE;

        // Ensure _sources directory exists
        fs.ensureDirSync(sourcesDir);

        let generatedCount = 0;
        let errorCount = 0;

        // Load sidebar.json to get all slugs
        const sidebarPath = PATHS.SIDEBAR_JSON;
        const sidebar = fs.existsSync(sidebarPath)
          ? JSON.parse(fs.readFileSync(sidebarPath, 'utf-8'))
          : [];

        // Flatten sidebar to get all slugs
        const slugs = extractSlugs(sidebar);

        // Add index page if not present
        if (!slugs.includes('index')) {
          slugs.push('index');
        }

        // Process each slug
        for (const slug of slugs) {
          try {
            // Find the markdown file in src/content/docs
            const mdFilePath = findMarkdownFile(docsDir, slug);
            if (!mdFilePath) {
              console.warn(`[ViewSource] No markdown file found for slug: ${slug}`);
              continue;
            }

            // Read raw markdown and frontmatter
            const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
            const { content: markdown, data: frontmatter } = matter(mdContent);

            // Find original source file path
            const sourceFilePath = findSourceFile(sourceDir, slug);

            // Read rendered HTML from dist.
            // astro build.format 이 'file' 이므로 비루트 페이지는 dist/{slug}.html 이다.
            // ('directory' 형식 fallback 도 함께 탐색)
            const slugParts = slug.split('/');
            const htmlCandidates = slug === 'index'
              ? [path.join(distDir, 'index.html')]
              : [
                  path.join(distDir, ...slugParts) + '.html',
                  path.join(distDir, ...slugParts, 'index.html'),
                ];
            const htmlPath = htmlCandidates.find((p) => fs.existsSync(p));
            const renderedHtml = htmlPath ? fs.readFileSync(htmlPath, 'utf-8') : null;

            if (!renderedHtml) {
              console.warn(`[ViewSource] No rendered HTML found for slug: ${slug}`);
              continue;
            }

            // Create JSON object
            const sourceData = {
              slug,
              markdown,
              html: renderedHtml,
              frontmatter,
              sourceFilePath: sourceFilePath || null,
              generatedAt: new Date().toISOString(),
            };

            // Write JSON file (use slug as filename, sanitize for filesystem)
            const jsonFileName = slug.replace(/\//g, '_') + '.json';
            const jsonFilePath = path.join(sourcesDir, jsonFileName);
            fs.writeJsonSync(jsonFilePath, sourceData, { spaces: 2 });

            generatedCount++;
          } catch (error) {
            console.error(`[ViewSource] Error processing slug "${slug}":`, error.message);
            errorCount++;
          }
        }

        console.log(`[ViewSource] Generated ${generatedCount} source files (${errorCount} errors)`);
      }
    }
  };
}

/**
 * Recursively extract all slugs from sidebar structure
 */
function extractSlugs(items) {
  const slugs = [];
  for (const item of items) {
    if (item.slug) {
      slugs.push(item.slug);
    }
    if (item.items) {
      slugs.push(...extractSlugs(item.items));
    }
  }
  return slugs;
}

/**
 * Find markdown file path given a slug
 */
function findMarkdownFile(docsDir, slug) {
  // Special case for index
  if (slug === 'index') {
    const indexPath = path.join(docsDir, 'index.md');
    return fs.existsSync(indexPath) ? indexPath : null;
  }

  // 중첩 slug('a/b/c')와 디렉토리 index slug('a/b/c' → a/b/c/index.md) 모두 대응
  const parts = slug.split('/');
  const candidates = [
    path.join(docsDir, ...parts) + '.md',
    path.join(docsDir, ...parts, 'index.md'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * Find original source file path
 */
function findSourceFile(sourceDir, slug) {
  // best-effort. 라벨은 실제 위치를 반영하도록 ROOT 기준 상대경로로 표기
  // (USE_SAMPLE_DIR 시 'sample/source/...', 기본 시 'source/...')
  const toLabel = (p) => path.relative(PATHS.ROOT, p);

  const candidates =
    slug === 'index'
      ? [path.join(sourceDir, 'README.md'), path.join(sourceDir, 'index.md')]
      : [
          path.join(sourceDir, ...slug.split('/')) + '.md',
          path.join(sourceDir, ...slug.split('/'), 'index.md'),
        ];

  const found = candidates.find((p) => fs.existsSync(p));
  return found ? toLabel(found) : null;
}
