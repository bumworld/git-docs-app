import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const SCRIPT = fs.readFileSync(path.join(process.cwd(), 'public', 'toc-button-helper.js'), 'utf-8');

function setup(desktop) {
  const dom = new JSDOM(`
    <!DOCTYPE html><html><body>
      <div class="right-sidebar-container">
        <div class="right-sidebar"><h2>On this page</h2></div>
      </div>
      <div id="starlight__on-this-page--mobile"></div>
    </body></html>
  `);
  global.window = dom.window;
  global.document = dom.window.document;
  global.module = { exports: {} };
  global.window.matchMedia = (q) => ({
    matches: q.includes('72rem') ? desktop : false,
    media: q, addEventListener() {}, removeEventListener() {},
  });
  // requestAnimationFrame/resize 안전장치
  global.window.requestAnimationFrame = (cb) => cb();
  eval(SCRIPT);
  return dom;
}

function makeBtn(cls) {
  return (isMobile) => {
    const b = global.document.createElement('button');
    b.className = isMobile ? cls + '-mobile' : cls;
    return b;
  };
}

describe('toc-button-helper', () => {
  after(() => { delete global.window; delete global.document; delete global.module; });

  it('desktop: inserts buttons after h2 in order', async () => {
    setup(true);
    global.window.registerTocButton({ className: 'toc-b', order: 20, create: makeBtn('toc-b') });
    global.window.registerTocButton({ className: 'toc-a', order: 10, create: makeBtn('toc-a') });
    await global.window.refreshTocButtons();
    const sidebar = global.document.querySelector('.right-sidebar');
    const h2 = sidebar.querySelector('h2');
    // h2 → toc-a(order10) → toc-b(order20)
    assert.strictEqual(h2.nextElementSibling.className, 'toc-a');
    assert.strictEqual(h2.nextElementSibling.nextElementSibling.className, 'toc-b');
  });

  it('desktop: re-render does not duplicate buttons', async () => {
    setup(true);
    global.window.registerTocButton({ className: 'toc-a', order: 10, create: makeBtn('toc-a') });
    await global.window.refreshTocButtons();
    await global.window.refreshTocButtons();
    assert.strictEqual(global.document.querySelectorAll('.toc-a').length, 1);
  });

  it('supports async create (Promise-returning)', async () => {
    setup(true);
    global.window.registerTocButton({
      className: 'toc-async',
      order: 10,
      create: (isMobile) => Promise.resolve(isMobile ? null : makeBtn('toc-async')(false)),
    });
    await global.window.refreshTocButtons();
    assert.strictEqual(global.document.querySelectorAll('.toc-async').length, 1);
  });

  it('mobile: appends to on-this-page--mobile', async () => {
    setup(false);
    global.window.registerTocButton({ className: 'toc-a', order: 10, create: makeBtn('toc-a') });
    await global.window.refreshTocButtons();
    assert.strictEqual(global.document.querySelectorAll('#starlight__on-this-page--mobile .toc-a-mobile').length, 1);
    assert.strictEqual(global.document.querySelectorAll('.right-sidebar .toc-a').length, 0);
  });

  it('mobile:false buttons are skipped on mobile', async () => {
    setup(false);
    global.window.registerTocButton({ className: 'toc-a', order: 10, mobile: false, create: makeBtn('toc-a') });
    await global.window.refreshTocButtons();
    assert.strictEqual(global.document.querySelectorAll('.toc-a-mobile').length, 0);
  });

  it('presentationAware buttons are skipped in presentation mode', async () => {
    const dom = setup(true);
    const wrap = dom.window.document.createElement('div');
    wrap.className = 'presentation-wrapper';
    dom.window.document.body.appendChild(wrap);
    global.window.registerTocButton({ className: 'toc-a', order: 10, presentationAware: true, create: makeBtn('toc-a') });
    await global.window.refreshTocButtons();
    assert.strictEqual(global.document.querySelectorAll('.toc-a').length, 0);
  });
});
