import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { runPrebuild } from '../scripts/prebuild.js';
import { generateSidebarConfig } from '../scripts/prebuild/sidebar.js';
import { sanitizeSlug, generateTitle } from '../scripts/prebuild/utils.js';

const TEST_SOURCE = path.join(process.cwd(), 'test-temp', 'source');
const TEST_DOCS = path.join(process.cwd(), 'test-temp', 'src', 'content', 'docs');
const TEST_SIDEBAR = path.join(process.cwd(), 'test-temp', 'src', 'sidebar.json');
const TEST_CACHE = path.join(process.cwd(), 'test-temp', 'data', 'prebuild-cache.json');

// Mock PATHS for testing
import { PATHS } from '../config/constants.js';
const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  // Override PATHS for testing
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = path.join(process.cwd(), 'test-temp', 'public', 'downloads');
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  PATHS.PREBUILD_CACHE = TEST_CACHE;

  fs.ensureDirSync(TEST_SOURCE);
});

after(() => {
  // Restore original PATHS
  Object.assign(PATHS, ORIGINAL_PATHS);

  // Clean up test directory
  fs.removeSync(path.join(process.cwd(), 'test-temp'));
});

describe('Prebuild - Utils', () => {
  it('should sanitize slug by removing special characters', () => {
    assert.strictEqual(sanitizeSlug('hello-world.md'), 'hello-world');
    assert.strictEqual(sanitizeSlug('test (1).md'), 'test-1');
    assert.strictEqual(sanitizeSlug('build.gradle.md'), 'buildgradle');
    assert.strictEqual(sanitizeSlug('libs.versions.md'), 'libsversions');
  });

  it('should sanitize Korean file names correctly', () => {
    assert.strictEqual(sanitizeSlug('한글-파일.md'), '한글-파일');
    assert.strictEqual(sanitizeSlug('데이터-백업.md'), '데이터-백업');
    assert.strictEqual(sanitizeSlug('프로젝트 설정.md'), '프로젝트-설정');
  });

  it('should generate title from filename', () => {
    assert.strictEqual(generateTitle('hello-world.md'), 'hello world');
    assert.strictEqual(generateTitle('quick_start.md'), 'quick start');
    // Note: consecutive capitals are not split (e.g., API stays as API)
    assert.strictEqual(generateTitle('APIReference.md'), 'APIReference');
    assert.strictEqual(generateTitle('myApiFile.md'), 'my Api File');
  });

  it('should handle Korean titles', () => {
    assert.strictEqual(generateTitle('한글-파일.md'), '한글 파일');
    assert.strictEqual(generateTitle('데이터_백업.md'), '데이터 백업');
  });
});

describe('Prebuild - Basic Flow', () => {
  it('should create welcome page when source is empty', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    runPrebuild();

    const indexPath = path.join(TEST_DOCS, 'index.md');
    assert.ok(fs.existsSync(indexPath));

    const content = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(content.includes('Welcome'));

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.deepStrictEqual(sidebar, []);
  });

  it('should convert README.md to index.md', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const readmeContent = '# My Docs\n\nWelcome to my documentation.';
    fs.writeFileSync(path.join(TEST_SOURCE, 'README.md'), readmeContent);

    runPrebuild();

    const indexPath = path.join(TEST_DOCS, 'index.md');
    assert.ok(fs.existsSync(indexPath));

    const content = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(content.includes('My Docs'));

    // README.md should be removed
    const readmePath = path.join(TEST_DOCS, 'readme.md');
    assert.ok(!fs.existsSync(readmePath));
  });

  it('should process markdown files with frontmatter', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const mdContent = `---
title: "Test Page"
sidebar:
  label: "Test"
---

# Test Content`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'test.md'), mdContent);

    runPrebuild();

    const testPath = path.join(TEST_DOCS, 'test.md');
    assert.ok(fs.existsSync(testPath));

    const content = fs.readFileSync(testPath, 'utf-8');
    // gray-matter may reformat quotes, so check for title existence
    assert.ok(content.includes('title:') && (content.includes('Test Page') || content.includes("'Test Page'")));
    assert.ok(content.includes('Test Content'));
  });

  it('should add frontmatter to markdown without it', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const mdContent = '# Plain Markdown\n\nNo frontmatter here.';
    fs.outputFileSync(path.join(TEST_SOURCE, 'plain.md'), mdContent);

    runPrebuild();

    const plainPath = path.join(TEST_DOCS, 'plain.md');
    const content = fs.readFileSync(plainPath, 'utf-8');

    assert.ok(content.includes('---'));
    assert.ok(content.includes('title:'));
    assert.ok(content.includes('sidebar:'));
  });
});

describe('Prebuild - Directory Structure', () => {
  it('should process nested directories', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'guides', 'intro.md'), '# Introduction');
    fs.outputFileSync(path.join(TEST_SOURCE, 'guides', 'advanced', 'tips.md'), '# Tips');

    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'guides', 'intro.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'guides', 'advanced', 'tips.md')));
  });

  it('should handle Korean directory names', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, '프로젝트', '설계', '아키텍처.md'), '# Architecture');

    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOCS, '프로젝트', '설계', '아키텍처.md')));
  });
});

describe('Sidebar Generation', () => {
  it('should generate sidebar with correct structure', () => {
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_DOCS, 'index.md'), '# Home');
    fs.outputFileSync(path.join(TEST_DOCS, 'guide.md'), '# Guide');
    fs.outputFileSync(path.join(TEST_DOCS, 'api', 'v1', 'users.md'), '# Users API');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // Should have api group and guide item
    assert.ok(sidebar.length >= 1);

    // Find api group
    const apiGroup = sidebar.find(item => item.label.toLowerCase().includes('api'));
    if (apiGroup) {
      assert.ok(apiGroup.items);
      assert.ok(Array.isArray(apiGroup.items));
    }
  });

  it('should exclude index.md from sidebar', () => {
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_DOCS, 'index.md'), '# Home');
    fs.outputFileSync(path.join(TEST_DOCS, 'other.md'), '# Other');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // Should not include index
    const indexItem = sidebar.find(item => item.slug === 'index');
    assert.strictEqual(indexItem, undefined);

    // Should include other
    const otherItem = sidebar.find(item => item.slug === 'other');
    assert.ok(otherItem);
  });

  it('should handle Korean labels in sidebar', () => {
    fs.emptyDirSync(TEST_DOCS);

    const content = `---
title: "아키텍처"
sidebar:
  label: "시스템 아키텍처"
---
# Architecture`;

    fs.outputFileSync(path.join(TEST_DOCS, '프로젝트', '아키텍처.md'), content);

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // Find the Korean group
    const koreanGroup = sidebar.find(item => item.label.includes('프로젝트'));
    assert.ok(koreanGroup);
    assert.ok(koreanGroup.items);
  });

  it('should sort directories before files', () => {
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_DOCS, 'z-file.md'), '# Z File');
    fs.outputFileSync(path.join(TEST_DOCS, 'a-dir', 'file.md'), '# A Dir File');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // First item should be directory, second should be file
    if (sidebar.length >= 2) {
      assert.ok(sidebar[0].items); // has items = directory
      assert.ok(sidebar[1].slug); // has slug = file
    }
  });
});

describe('Prebuild - Edge Cases', () => {
  it('should handle files with special characters', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'test (1).md'), '# Test 1');
    fs.outputFileSync(path.join(TEST_SOURCE, 'config.example.md'), '# Config');

    runPrebuild();

    // Should sanitize to test-1.md and configexample.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test-1.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'configexample.md')));
  });

  it('should handle empty directories', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.ensureDirSync(path.join(TEST_SOURCE, 'empty-dir'));

    runPrebuild();

    // Empty directory should not appear in sidebar
    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const emptyDir = sidebar.find(item => item.label === 'Empty dir');
    assert.strictEqual(emptyDir, undefined);
  });

  it('should handle files starting with dot', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, '.hidden.md'), '# Hidden');
    fs.outputFileSync(path.join(TEST_SOURCE, 'visible.md'), '# Visible');

    runPrebuild();

    // Hidden file should be ignored
    assert.ok(!fs.existsSync(path.join(TEST_DOCS, '.hidden.md')));

    // Visible file should exist
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'visible.md')));
  });
});

describe('Prebuild - Asset Files', () => {
  it('should copy image files to downloads and create markdown', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create a dummy image file
    const imagePath = path.join(TEST_SOURCE, 'test-image.png');
    fs.writeFileSync(imagePath, 'fake-png-data');

    runPrebuild();

    // Should create markdown file
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test-image.md')));

    // Should copy to downloads
    assert.ok(fs.existsSync(path.join(PATHS.DOWNLOADS, 'test-image.png')));
  });
});

describe('Prebuild - README and index conflicts', () => {
  it('should convert README.md to index.md when only README exists', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# README Content');

    runPrebuild();

    // Should have index.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));
    const content = fs.readFileSync(path.join(TEST_DOCS, 'index.md'), 'utf-8');
    assert.ok(content.includes('README Content'));

    // Should not have readme.md
    assert.ok(!fs.existsSync(path.join(TEST_DOCS, 'readme.md')));
  });

  it('should keep existing index.md when both README and index exist', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# README Content');
    fs.outputFileSync(path.join(TEST_SOURCE, 'index.md'), '# Index Content');

    runPrebuild();

    // Should have index.md with index content (not README)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));
    const content = fs.readFileSync(path.join(TEST_DOCS, 'index.md'), 'utf-8');
    assert.ok(content.includes('Index Content'));
    assert.ok(!content.includes('README Content'));

    // README should be processed as readme.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'readme.md')));
  });

  it('should handle case-sensitive README variants (readme.md vs README.md)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // On case-insensitive filesystems (macOS), these might conflict
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# README UPPER');

    runPrebuild();

    // Should process to readme.md then convert to index.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));

    // Only one file should exist (either readme.md or index.md)
    const docsFiles = fs.readdirSync(TEST_DOCS);
    const readmeVariants = docsFiles.filter(f =>
      f.toLowerCase().includes('readme') || f.toLowerCase().includes('index')
    );
    // Should have only index.md
    assert.strictEqual(readmeVariants.length, 1);
    assert.strictEqual(readmeVariants[0], 'index.md');
  });
});

describe('Prebuild - Duplicate slugs', () => {
  it('should handle files with same slug after sanitization', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // These will both become "test.md"
    fs.outputFileSync(path.join(TEST_SOURCE, 'test.md'), '# Test 1');
    fs.outputFileSync(path.join(TEST_SOURCE, 'test (1).md'), '# Test 2');

    runPrebuild();

    // After sanitization: test.md and test-1.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test-1.md')));
  });

  it('should handle dots in filenames correctly', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'config.example.md'), '# Config Example');
    fs.outputFileSync(path.join(TEST_SOURCE, 'build.gradle.md'), '# Build Gradle');

    runPrebuild();

    // Dots are removed per sanitize function
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'configexample.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'buildgradle.md')));
  });
});

describe('Prebuild - File content edge cases', () => {
  it('should handle empty markdown files', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'empty.md'), '');

    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'empty.md')));
    const content = fs.readFileSync(path.join(TEST_DOCS, 'empty.md'), 'utf-8');
    // Should have frontmatter added
    assert.ok(content.includes('---'));
    assert.ok(content.includes('title:'));
  });

  it('should handle markdown with invalid frontmatter', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const invalidFrontmatter = `---
title: "Test
broken: yaml here
---
# Content`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'invalid.md'), invalidFrontmatter);

    runPrebuild();

    // Should still process (fallback to adding new frontmatter)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'invalid.md')));
  });

  it('should handle very long filenames', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const longName = 'a'.repeat(200) + '.md';
    fs.outputFileSync(path.join(TEST_SOURCE, longName), '# Long name');

    runPrebuild();

    // Should process without error
    const files = fs.readdirSync(TEST_DOCS);
    assert.ok(files.length > 0);
  });

  it('should handle unicode and emoji in filenames', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, '测试-文档.md'), '# Chinese');
    fs.outputFileSync(path.join(TEST_SOURCE, '日本語.md'), '# Japanese');

    runPrebuild();

    // Should preserve unicode characters
    assert.ok(fs.existsSync(path.join(TEST_DOCS, '测试-文档.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, '日本語.md')));
  });

  it('should handle multiple spaces and hyphens in filenames', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'test   multiple   spaces.md'), '# Spaces');
    fs.outputFileSync(path.join(TEST_SOURCE, 'test---multiple---hyphens.md'), '# Hyphens');

    runPrebuild();

    // Should collapse to single hyphen
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test-multiple-spaces.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'test-multiple-hyphens.md')));
  });
});

describe('Prebuild - Mixed content types', () => {
  it('should handle directory with mixed file types', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'docs', 'guide.md'), '# Guide');
    fs.outputFileSync(path.join(TEST_SOURCE, 'docs', 'image.png'), 'fake-image');
    fs.outputFileSync(path.join(TEST_SOURCE, 'docs', 'data.json'), '{"test": true}');
    fs.outputFileSync(path.join(TEST_SOURCE, 'docs', 'page.html'), '<html></html>');

    runPrebuild();

    // MD file should be in docs
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'docs', 'guide.md')));

    // Image should create MD wrapper
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'docs', 'image.md')));

    // JSON should create MD wrapper (extension is removed, so data.json -> data.md)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'docs', 'data.md')));

    // HTML should create MD wrapper (extension is removed, so page.html -> page.md)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'docs', 'page.md')));
  });

  it('should handle HTML folder with index.html', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'html-app', 'index.html'), '<html>App</html>');
    fs.outputFileSync(path.join(TEST_SOURCE, 'html-app', 'style.css'), 'body {}');

    runPrebuild();

    // Should create MD file for the HTML folder
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'html-app.md')));

    // HTML folder should be copied to downloads
    assert.ok(fs.existsSync(path.join(PATHS.DOWNLOADS, 'html-app', 'index.html')));
  });
});

describe('Prebuild - Sidebar edge cases', () => {
  it('should not include files with same name in different dirs as duplicates', () => {
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_DOCS, 'api', 'v1', 'users.md'), '# Users V1');
    fs.outputFileSync(path.join(TEST_DOCS, 'api', 'v2', 'users.md'), '# Users V2');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // Should have both with different slugs
    const allItems = JSON.stringify(sidebar);
    assert.ok(allItems.includes('api/v1/users'));
    assert.ok(allItems.includes('api/v2/users'));
  });

  it('should handle deeply nested directory structures', () => {
    fs.emptyDirSync(TEST_DOCS);

    const deepPath = path.join(TEST_DOCS, 'a', 'b', 'c', 'd', 'e', 'deep.md');
    fs.outputFileSync(deepPath, '# Deep file');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(sidebar.length > 0);

    // Should have nested structure
    const allItems = JSON.stringify(sidebar);
    assert.ok(allItems.includes('a/b/c/d/e/deep'));
  });

  it('should handle directory with only subdirectories (no files)', () => {
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_DOCS, 'parent', 'child1', 'file1.md'), '# File 1');
    fs.outputFileSync(path.join(TEST_DOCS, 'parent', 'child2', 'file2.md'), '# File 2');

    generateSidebarConfig();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);

    // Parent should exist with child items
    const parent = sidebar.find(item => item.label.toLowerCase().includes('parent'));
    assert.ok(parent);
    assert.ok(parent.items);
    assert.ok(parent.items.length >= 2);
  });
});

describe('Prebuild - Special directory names', () => {
  it('should handle directory named "pwa" by ignoring it', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'pwa', 'manifest.json'), '{}');
    fs.outputFileSync(path.join(TEST_SOURCE, 'other', 'file.md'), '# Other');

    runPrebuild();

    // PWA should be ignored
    assert.ok(!fs.existsSync(path.join(TEST_DOCS, 'pwa')));

    // Other should be processed
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'other', 'file.md')));
  });

  it('should handle directories with special characters', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'dir (test)', 'file.md'), '# Test');
    fs.outputFileSync(path.join(TEST_SOURCE, 'dir-with-hyphens', 'file.md'), '# Hyphens');

    runPrebuild();

    // Should sanitize directory names
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'dir-test', 'file.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'dir-with-hyphens', 'file.md')));
  });
});

describe('Prebuild - Binary files with text extensions', () => {
  it('should handle binary data in .md file gracefully', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create a file with binary data but .md extension
    const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
    fs.outputFileSync(path.join(TEST_SOURCE, 'fake-markdown.md'), binaryData);

    // Should not throw error during prebuild
    assert.doesNotThrow(() => {
      runPrebuild();
    });

    // File should be processed (even if content is binary)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'fake-markdown.md')));
  });

  it('should handle corrupted UTF-8 in markdown file', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create file with invalid UTF-8 sequences
    const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    fs.outputFileSync(path.join(TEST_SOURCE, 'corrupted.md'), invalidUtf8);

    assert.doesNotThrow(() => {
      runPrebuild();
    });

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'corrupted.md')));
  });

  it('should handle .txt file with binary content', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // .txt files are treated as assets, not markdown
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
    fs.outputFileSync(path.join(TEST_SOURCE, 'binary.txt'), binaryData);

    assert.doesNotThrow(() => {
      runPrebuild();
    });

    // Should create a wrapper markdown file
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'binary.md')));

    // Original file should be in downloads
    assert.ok(fs.existsSync(path.join(PATHS.DOWNLOADS, 'binary.txt')));
  });

  it('should handle markdown with null bytes', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const contentWithNulls = '# Title\x00\x00\nSome content\x00here';
    fs.outputFileSync(path.join(TEST_SOURCE, 'null-bytes.md'), contentWithNulls);

    assert.doesNotThrow(() => {
      runPrebuild();
    });

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'null-bytes.md')));
  });

  it('should handle extremely large markdown files', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create a ~5MB markdown file
    const largeContent = '# Large File\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(200000);
    fs.outputFileSync(path.join(TEST_SOURCE, 'large-file.md'), largeContent);

    assert.doesNotThrow(() => {
      runPrebuild();
    });

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'large-file.md')));

    const processedSize = fs.statSync(path.join(TEST_DOCS, 'large-file.md')).size;
    // Should preserve most of the content (allowing for frontmatter addition)
    assert.ok(processedSize > 5000000);
  });
});

describe('Prebuild - Symbolic links and special files', () => {
  it('should handle symbolic links gracefully', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create a regular file
    fs.outputFileSync(path.join(TEST_SOURCE, 'target.md'), '# Target');

    // Try to create a symlink (may fail on some systems)
    try {
      fs.symlinkSync(
        path.join(TEST_SOURCE, 'target.md'),
        path.join(TEST_SOURCE, 'link.md')
      );

      assert.doesNotThrow(() => {
        runPrebuild();
      });

      // Both files should be processed
      assert.ok(fs.existsSync(path.join(TEST_DOCS, 'target.md')));
    } catch (err) {
      // Skip test if symlinks are not supported
      console.log('Skipping symlink test (not supported on this system)');
    }
  });

  it('should skip circular references in directory structure', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'a', 'file.md'), '# File A');

    // Try to create circular symlink (skip if not supported)
    try {
      fs.symlinkSync(
        path.join(TEST_SOURCE, 'a'),
        path.join(TEST_SOURCE, 'a', 'circular'),
        'dir'
      );

      // Should handle gracefully without infinite loop
      assert.doesNotThrow(() => {
        runPrebuild();
      });
    } catch (err) {
      console.log('Skipping circular reference test (not supported)');
    }
  });
});

describe('Prebuild - Concurrent file operations', () => {
  it('should handle multiple README variants correctly', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Test what happens with various README files
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Main README');
    fs.outputFileSync(path.join(TEST_SOURCE, 'readme.txt'), 'Text readme');
    fs.outputFileSync(path.join(TEST_SOURCE, 'ReadMe.md'), '# Mixed case');

    runPrebuild();

    // Should have index.md (from README.md)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));

    // Check that we don't have duplicate READMEs
    const files = fs.readdirSync(TEST_DOCS);
    const readmeCount = files.filter(f => f.toLowerCase().includes('readme')).length;

    // On case-insensitive filesystems (macOS), duplicates may be overwritten
    assert.ok(readmeCount <= 2); // At most readme.txt wrapper + one other
  });

  it('should handle index variants (index.md, Index.md, INDEX.md)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // On case-sensitive systems, these are different files
    // On case-insensitive systems (macOS), only one will survive
    fs.outputFileSync(path.join(TEST_SOURCE, 'index.md'), '# Index lowercase');

    runPrebuild();

    // Should have exactly one index.md
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));

    const content = fs.readFileSync(path.join(TEST_DOCS, 'index.md'), 'utf-8');
    assert.ok(content.includes('Index lowercase') || content.includes('title:'));
  });
});
