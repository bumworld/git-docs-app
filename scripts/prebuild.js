import fs from 'fs-extra';
import path from 'path';
import { PATHS, IGNORE_FILES } from '../config/constants.js';
import { generateTitle } from './prebuild/utils.js';
import { processDirectory } from './prebuild/processors.js';
import { generateSidebarConfig } from './prebuild/sidebar.js';

export function runPrebuild() {
  console.log('[Prebuild] Starting content sync from source/ to src/content/docs/');

  // Clean target directories
  fs.emptyDirSync(PATHS.DOCS);
  fs.emptyDirSync(PATHS.DOWNLOADS);

  // Check if source directory exists and has content
  if (!fs.existsSync(PATHS.SOURCE)) {
    fs.ensureDirSync(PATHS.SOURCE);
    console.log('[Prebuild] source/ directory created (empty)');
  }

  const entries = fs.readdirSync(PATHS.SOURCE);
  if (entries.length === 0 || (entries.length === 1 && IGNORE_FILES.includes(entries[0]))) {
    const welcomeContent = `---
title: "Welcome"
sidebar:
  label: "Welcome"
---

# Welcome to Git Docs

Add your markdown files to the \`source/\` directory to get started.

## Getting Started

1. Place \`.md\` files in the \`source/\` folder
2. Organize with subdirectories for navigation structure
3. HTML folders with \`index.html\` will be embedded as iframes
4. Other files will be available as downloads
`;
    fs.outputFileSync(path.join(PATHS.DOCS, 'index.md'), welcomeContent, 'utf-8');
    console.log('[Prebuild] Created default welcome page');
    return;
  }

  processDirectory(PATHS.SOURCE, PATHS.DOCS, PATHS.DOWNLOADS);

  // Ensure at least an index page exists
  const indexPath = path.join(PATHS.DOCS, 'index.md');
  if (!fs.existsSync(indexPath)) {
    const readmeSrc = path.join(PATHS.SOURCE, 'README.md');
    if (fs.existsSync(readmeSrc)) {
      fs.copySync(path.join(PATHS.DOCS, 'README.md'), indexPath);
      fs.removeSync(path.join(PATHS.DOCS, 'README.md'));
    } else {
      // Auto-generate index with list of top-level folders/files
      const srcEntries = fs.readdirSync(PATHS.SOURCE, { withFileTypes: true });
      const folders = srcEntries.filter(e => e.isDirectory() && !IGNORE_FILES.includes(e.name));
      let listItems = '';
      for (const folder of folders) {
        const label = generateTitle(folder.name);
        const slug = folder.name.toLowerCase();
        listItems += `- [${label}](/${slug}/)\n`;
      }

      const content = `---
title: "Home"
sidebar:
  label: "Home"
---

${listItems ? '## Contents\n\n' + listItems : 'Navigate using the sidebar.'}
`;
      fs.outputFileSync(indexPath, content, 'utf-8');
      console.log('[Prebuild] Auto-generated index page');
    }
  }

  generateSidebarConfig();
  console.log('[Prebuild] Content sync complete');
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('prebuild.js')) {
  runPrebuild();
}
