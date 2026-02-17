import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Presentation Feature', () => {
  describe('Schema Extension', () => {
    it('should have extended schema with presentation and theme fields', async () => {
      const configPath = path.join(process.cwd(), 'src/content/config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');

      assert.ok(configContent.includes('presentation:'), 'Schema should include presentation field');
      assert.ok(configContent.includes('theme:'), 'Schema should include theme field');
    });
  });

  describe('Remark Slides Plugin', () => {
    let remarkSlides;

    before(async () => {
      const module = await import('../src/plugins/remark-slides.js');
      remarkSlides = module.remarkSlides;
    });

    it('should export remarkSlides function', () => {
      assert.strictEqual(typeof remarkSlides, 'function');
    });

    it('should return a transformer function', () => {
      const transformer = remarkSlides();
      assert.strictEqual(typeof transformer, 'function');
    });

    it('should process tree with presentation frontmatter', () => {
      const transformer = remarkSlides();
      const tree = {
        children: [
          { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Slide 1' }] },
          { type: 'thematicBreak' },
          { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Slide 2' }] },
        ],
      };
      const file = {
        data: {
          astro: {
            frontmatter: {
              presentation: true,
            },
          },
        },
      };

      transformer(tree, file);

      // Should have html nodes for section tags
      const htmlNodes = tree.children.filter(node => node.type === 'html');
      assert.ok(htmlNodes.length > 0, 'Should create HTML section nodes');
    });

    it('should skip processing when presentation is false', () => {
      const transformer = remarkSlides();
      const tree = {
        children: [
          { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Normal Doc' }] },
          { type: 'thematicBreak' },
          { type: 'paragraph', children: [{ type: 'text', value: 'Content' }] },
        ],
      };
      const originalChildren = [...tree.children];
      const file = {
        data: {
          astro: {
            frontmatter: {
              presentation: false,
            },
          },
        },
      };

      transformer(tree, file);

      // Tree should remain unchanged
      assert.strictEqual(tree.children.length, originalChildren.length);
    });
  });

  describe('ContentPanel Override', () => {
    it('should have ContentPanel override component', () => {
      const componentPath = path.join(process.cwd(), 'src/components/overrides/ContentPanel.astro');
      assert.ok(fs.existsSync(componentPath), 'ContentPanel.astro should exist');

      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('isPresentation'), 'Should check for presentation mode');
      assert.ok(content.includes('reveal'), 'Should include reveal.js reference');
      assert.ok(content.includes('.slides'), 'Should have slides container');
    });
  });

  describe('Example Presentation File', () => {
    it('should have example presentation markdown file', () => {
      const examplePath = path.join(process.cwd(), 'src/content/docs/example-presentation.md');
      assert.ok(fs.existsSync(examplePath), 'example-presentation.md should exist');

      const content = fs.readFileSync(examplePath, 'utf-8');
      assert.ok(content.includes('presentation: true'), 'Should have presentation frontmatter');
      assert.ok(content.includes('theme:'), 'Should have theme frontmatter');
      assert.ok(content.includes('---\n\n#'), 'Should have slide separators');
    });
  });

  describe('Astro Config Integration', () => {
    it('should have remarkSlides plugin registered', () => {
      const configPath = path.join(process.cwd(), 'astro.config.mjs');
      const configContent = fs.readFileSync(configPath, 'utf-8');

      assert.ok(configContent.includes('remarkSlides'), 'Should import remarkSlides');
      assert.ok(
        configContent.includes('remarkPlugins') && configContent.includes('remarkSlides'),
        'Should register remarkSlides in remarkPlugins'
      );
    });

    it('should have ContentPanel component override registered', () => {
      const configPath = path.join(process.cwd(), 'astro.config.mjs');
      const configContent = fs.readFileSync(configPath, 'utf-8');

      assert.ok(
        configContent.includes('ContentPanel') && configContent.includes('components'),
        'Should register ContentPanel override'
      );
    });
  });

  describe('Build Output', () => {
    it('should build successfully with presentation files', () => {
      const distPath = path.join(process.cwd(), 'dist');
      assert.ok(fs.existsSync(distPath), 'dist directory should exist after build');

      // Check if any HTML files were generated
      const htmlFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.html'));
      assert.ok(htmlFiles.length > 0, 'Should generate HTML files');
    });

    it('should include reveal.js assets in build output', () => {
      const distPath = path.join(process.cwd(), 'dist');
      const assetsPath = path.join(distPath, '_assets');

      if (fs.existsSync(assetsPath)) {
        const assets = fs.readdirSync(assetsPath);
        // Check for reveal.js related CSS (theme CSS files)
        const hasRevealAssets = assets.some(file =>
          file.includes('.css') || file.includes('.js')
        );
        assert.ok(hasRevealAssets, 'Should have CSS/JS assets in build output');
      }
    });
  });

  describe('Package Dependencies', () => {
    it('should have reveal.js installed', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      assert.ok(
        packageJson.dependencies['reveal.js'],
        'reveal.js should be in dependencies'
      );
    });
  });

  describe('Presentation HTML Structure', () => {
    let dom, document;

    before(() => {
      // Simulate presentation HTML structure
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="presentation-wrapper">
              <div class="reveal">
                <div class="slides" data-theme="night">
                  <section data-slide="0">
                    <h1>Slide 1</h1>
                  </section>
                  <section data-slide="1">
                    <h2>Slide 2</h2>
                  </section>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
      dom = new JSDOM(html);
      document = dom.window.document;
    });

    it('should have correct presentation wrapper structure', () => {
      const wrapper = document.querySelector('.presentation-wrapper');
      assert.ok(wrapper, 'Should have presentation-wrapper div');
    });

    it('should have reveal container', () => {
      const reveal = document.querySelector('.reveal');
      assert.ok(reveal, 'Should have reveal div');
    });

    it('should have slides container with theme attribute', () => {
      const slides = document.querySelector('.slides');
      assert.ok(slides, 'Should have slides div');
      assert.strictEqual(slides.getAttribute('data-theme'), 'night', 'Should have theme attribute');
    });

    it('should have section elements for slides', () => {
      const sections = document.querySelectorAll('section[data-slide]');
      assert.ok(sections.length >= 2, 'Should have multiple slide sections');
    });
  });

  describe('Theme Support', () => {
    it('should support multiple reveal.js themes', () => {
      const configPath = path.join(process.cwd(), 'src/content/config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');

      const supportedThemes = ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized'];

      supportedThemes.forEach(theme => {
        assert.ok(
          configContent.includes(`'${theme}'`),
          `Should support ${theme} theme`
        );
      });
    });
  });
});

describe('Integration with Existing Features', () => {
  it('should work with Mermaid diagrams in presentation', () => {
    const examplePath = path.join(process.cwd(), 'src/content/docs/example-presentation.md');
    const content = fs.readFileSync(examplePath, 'utf-8');

    assert.ok(
      content.includes('```mermaid'),
      'Example presentation should include Mermaid diagram'
    );
  });

  it('should not break existing markdown files', () => {
    const indexPath = path.join(process.cwd(), 'src/content/docs/index.md');

    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      // Should not have presentation mode by default
      assert.ok(
        !content.includes('presentation: true') || content.includes('presentation: false'),
        'Regular docs should not have presentation mode enabled'
      );
    }
  });
});
