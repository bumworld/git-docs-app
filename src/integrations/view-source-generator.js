import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

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
        const docsDir = path.join(process.cwd(), 'src/content/docs');
        const sourceDir = path.join(process.cwd(), 'source');

        // Ensure _sources directory exists
        fs.ensureDirSync(sourcesDir);

        let generatedCount = 0;
        let errorCount = 0;

        // Load sidebar.json to get all slugs
        const sidebarPath = path.join(process.cwd(), 'src/sidebar.json');
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

            // Read rendered HTML from dist
            // Special case: index page is at dist/index.html, not dist/index/index.html
            const htmlPath = slug === 'index'
              ? path.join(distDir, 'index.html')
              : path.join(distDir, slug, 'index.html');
            const renderedHtml = fs.existsSync(htmlPath)
              ? fs.readFileSync(htmlPath, 'utf-8')
              : null;

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

  // Try exact path
  const exactPath = path.join(docsDir, slug + '.md');
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  // Try with directory structure (slug might use '/')
  const pathWithSlashes = path.join(docsDir, ...slug.split('/')) + '.md';
  if (fs.existsSync(pathWithSlashes)) {
    return pathWithSlashes;
  }

  return null;
}

/**
 * Find original source file path
 */
function findSourceFile(sourceDir, slug) {
  // This is best-effort; source files may have been renamed during prebuild
  if (slug === 'index') {
    const readmePath = path.join(sourceDir, 'README.md');
    return fs.existsSync(readmePath) ? 'source/README.md' : 'source/index.md';
  }

  // Try to reconstruct original path
  const possiblePath = path.join(sourceDir, ...slug.split('/')) + '.md';
  if (fs.existsSync(possiblePath)) {
    return 'source/' + slug.split('/').join('/') + '.md';
  }

  return null;
}
