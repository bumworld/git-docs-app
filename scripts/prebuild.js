import fs from 'fs-extra';
import path from 'path';
import { PATHS, IGNORE_FILES } from '../config/constants.js';
import { generateTitle } from './prebuild/utils.js';
import { processDirectory, createStats } from './prebuild/processors.js';
import { generateSidebarConfig } from './prebuild/sidebar.js';
import { loadCache, saveCache } from './prebuild/cache.js';
import { loadGitdocsConfig } from './prebuild/config.js';

export function runPrebuild() {
  console.log('[Prebuild] Starting content sync from source/ to src/content/docs/');

  // 증분 빌드: 캐시 로드 (없으면 전체 처리)
  const cache = loadCache(PATHS.PREBUILD_CACHE);
  const cacheCtx = { cache: cache.files, newEntries: {} };
  const isFirstRun = Object.keys(cache.files).length === 0;
  if (!isFirstRun) {
    console.log(`[Prebuild] 증분 빌드 모드 — 캐시 ${Object.keys(cache.files).length}개 항목 로드`);
  }

  // 첫 실행 시에만 전체 초기화 (이후는 diff 방식)
  if (isFirstRun) {
    fs.emptyDirSync(PATHS.DOCS);
    fs.emptyDirSync(PATHS.DOWNLOADS);
  } else {
    fs.ensureDirSync(PATHS.DOCS);
    fs.ensureDirSync(PATHS.DOWNLOADS);
  }

  // Check if source directory exists and has content
  if (!fs.existsSync(PATHS.SOURCE)) {
    fs.ensureDirSync(PATHS.SOURCE);
    console.log('[Prebuild] source/ directory created (empty)');
  }

  // .gitdocs.json 로드 (없으면 빈 객체)
  const gitdocsConfig = loadGitdocsConfig(PATHS.SOURCE);

  const entries = fs.readdirSync(PATHS.SOURCE).filter(e => !IGNORE_FILES.includes(e));
  console.log(`[Prebuild] source/ has ${entries.length} entries: ${entries.slice(0, 10).join(', ')}${entries.length > 10 ? '...' : ''}`);
  if (entries.length === 0) {
    const welcomeContent = `---
title: "Welcome"
---

# Welcome
`;
    fs.outputFileSync(path.join(PATHS.DOCS, 'index.md'), welcomeContent, 'utf-8');
    fs.writeJsonSync(PATHS.SIDEBAR_JSON, [], { spaces: 2 });
    console.log('[Prebuild] Created default welcome page');
    console.log('[Prebuild] WARNING: source/ is empty — dist will not be updated to preserve existing content');
    return false;
  }

  const stats = createStats();
  processDirectory(PATHS.SOURCE, PATHS.DOCS, PATHS.DOWNLOADS, '', stats, cacheCtx, gitdocsConfig);

  // 삭제된 소스 파일에 대응하는 dest 파일 제거
  let deletedCount = 0;
  for (const [relPath, entry] of Object.entries(cache.files)) {
    if (!cacheCtx.newEntries[relPath]) {
      for (const destFile of entry.destFiles || []) {
        try {
          fs.removeSync(destFile);
        } catch { /* ignore */ }
      }
      deletedCount++;
    }
  }

  // 캐시 저장
  saveCache(PATHS.PREBUILD_CACHE, cacheCtx.newEntries);

  // Ensure at least an index page exists
  const indexPath = path.join(PATHS.DOCS, 'index.md');
  if (!fs.existsSync(indexPath)) {
    // Try to use README.md (sanitized as readme.md by processMarkdownFile)
    const readmeDest = path.join(PATHS.DOCS, 'readme.md');
    if (fs.existsSync(readmeDest)) {
      fs.copySync(readmeDest, indexPath);
      fs.removeSync(readmeDest);
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

  generateSidebarConfig(gitdocsConfig);

  // 처리 결과 요약 로그
  const { byType, largeFiles, longPaths, errors, collisions } = stats;
  console.log(`[Prebuild] 처리 완료 — 처리:${stats.processed} 스킵:${stats.skipped} 삭제:${deletedCount} (md:${byType.markdown} html:${byType.html} img:${byType.image} asset:${byType.asset} txt-noext:${byType.textNoExt} static:${byType.static})`);

  if (collisions.length > 0) {
    console.warn(`[Prebuild] 경로 충돌 ${collisions.length}개 (동일 출력 경로로 인해 건너뜀):`);
    collisions.forEach(c => console.warn(`[Prebuild]   - ${c.src} → ${c.dest}`));
  }

  if (largeFiles.length > 0) {
    console.warn(`[Prebuild] 대용량 파일 ${largeFiles.length}개 (빌드 속도에 영향 가능):`);
    largeFiles.forEach(f => console.warn(`[Prebuild]   - ${f.file} (${(f.size / 1024 / 1024).toFixed(1)}MB)`));
  }

  if (longPaths.length > 0) {
    console.warn(`[Prebuild] 경로가 긴 파일 ${longPaths.length}개:`);
    longPaths.forEach(f => console.warn(`[Prebuild]   - ${f} (${f.length}자)`));
  }

  if (errors.length > 0) {
    console.error(`[Prebuild] 오류 ${errors.length}개:`);
    errors.forEach(e => console.error(`[Prebuild]   - ${e.file} → ${e.message}`));
  }

  return true;
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('prebuild.js')) {
  runPrebuild();
}
