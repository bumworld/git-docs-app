import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

describe('Print Button', () => {
  let window, document, printModule;

  before(async () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="right-sidebar-container">
            <div class="right-sidebar">
              <h2>On this page</h2>
              <ul><li><a href="#section1">Section 1</a></li></ul>
            </div>
          </div>
          <main>
            <div class="sl-markdown-content">
              <h1>Test Content</h1>
            </div>
          </main>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.module = { exports: {} };
    // matchMedia 모킹: 72rem+ (데스크탑) 환경 시뮬레이션
    global.window.matchMedia = (query) => ({
      matches: query.includes('72rem') ? true : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.join(process.cwd(), 'public', 'print-button.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    eval(scriptContent);
    printModule = global.module.exports;
  });

  after(() => {
    delete global.window;
    delete global.document;
    delete global.module;
  });

  it('should create print button with correct structure', () => {
    const btn = printModule.createPrintButton();
    assert.ok(btn instanceof window.HTMLElement);
    assert.strictEqual(btn.className, 'toc-print-btn');
    assert.ok(btn.querySelector('svg'));
    assert.ok(btn.querySelector('span'));
    assert.strictEqual(btn.getAttribute('title'), 'Print page as PDF');
  });

  it('should insert button in TOC after heading', () => {
    printModule.initPrintButton();
    const rightSidebar = document.querySelector('.right-sidebar');
    const tocHeading = rightSidebar.querySelector('h2');
    const printBtn = rightSidebar.querySelector('.toc-print-btn');

    assert.ok(printBtn);
    assert.strictEqual(tocHeading.nextElementSibling, printBtn);
  });

  it('should call window.print when button clicked', () => {
    const mockPrint = mock.fn();
    window.print = mockPrint;

    const btn = printModule.createPrintButton();
    btn.click();

    assert.strictEqual(mockPrint.mock.calls.length, 1);
  });

  it('should handle missing right-sidebar gracefully', () => {
    const rightSidebar = document.querySelector('.right-sidebar-container');
    rightSidebar.remove();

    assert.doesNotThrow(() => {
      printModule.initPrintButton();
    });
  });

  it('should be accessible', () => {
    // 사이드바 재생성
    const rightSidebarContainer = document.createElement('div');
    rightSidebarContainer.className = 'right-sidebar-container';
    const rightSidebar = document.createElement('div');
    rightSidebar.className = 'right-sidebar';
    const tocHeading = document.createElement('h2');
    tocHeading.textContent = 'On this page';
    rightSidebar.appendChild(tocHeading);
    rightSidebarContainer.appendChild(rightSidebar);
    document.body.appendChild(rightSidebarContainer);

    printModule.initPrintButton();
    const btn = document.querySelector('.toc-print-btn');
    assert.ok(btn.getAttribute('aria-label'));
    assert.ok(btn.getAttribute('title'));
  });

  it('should optimize mermaid diagrams for print', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid-viewport';
    mermaidDiv.innerHTML = '<svg style="width: 500px"></svg>';
    document.body.appendChild(mermaidDiv);

    printModule.prepareForPrint();

    const svg = mermaidDiv.querySelector('svg');
    assert.strictEqual(svg.style.maxWidth, '100%');
    assert.strictEqual(svg.style.height, 'auto');
  });
});

describe('Print CSS', () => {
  it('should have print.css file', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.join(process.cwd(), 'src', 'styles', 'print.css');
    assert.ok(fs.existsSync(cssPath), 'print.css should exist');
  });
});
