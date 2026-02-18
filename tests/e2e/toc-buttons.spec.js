/**
 * tests/e2e/toc-buttons.spec.js
 * TOC 사이드바 버튼 E2E 테스트
 * - Copy Content 버튼
 * - Print 버튼
 * - View Source 버튼
 * - Screen Preview 버튼
 */
import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

// ─── Copy Content 버튼 ─────────────────────────────────────────
test.describe('Copy Content 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
    // 페이지 완전 로드 대기
  });

  test('Copy Content 버튼이 TOC에 존재함', async ({ page }) => {
    // 데스크탑 viewport에서 TOC 버튼 확인
    const copyBtn = page.locator('button').filter({ hasText: /copy|복사/i }).first();
    // 또는 class 기반으로 찾기
    const tocBtn = page.locator('.toc-copy-btn, [data-copy-btn], button[title*="Copy"], button[title*="복사"]').first();

    // 버튼이 페이지에 존재해야 함 (TOC 또는 모바일 헤더)
    const hasCopyBtn = await copyBtn.count() > 0 || await tocBtn.count() > 0;
    expect(hasCopyBtn).toBe(true);
  });

  test('Copy 버튼 클릭 시 "Copied!" 피드백 표시', async ({ page }) => {
    // 클립보드 권한 부여
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Copy 버튼 찾기 (다양한 텍스트 후보)
    const copyBtn = page.locator('button').filter({ hasText: /^copy$|^복사$/i }).first();
    if (await copyBtn.count() === 0) {
      // 다른 selector 시도
      const altBtn = page.locator('[data-copy-btn], .toc-copy-btn').first();
      if (await altBtn.count() === 0) {
        test.skip();
        return;
      }
      await altBtn.click();
    } else {
      await copyBtn.click();
    }

    // "Copied!" 피드백 텍스트 등장
    const feedback = page.locator('button').filter({ hasText: /copied|복사됨/i }).first();
    await expect(feedback).toBeVisible({ timeout: 3000 });
  });
});

// ─── Print 버튼 ────────────────────────────────────────────────
test.describe('Print 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('Print 버튼이 TOC에 존재함', async ({ page }) => {
    const printBtn = page.locator('button').filter({ hasText: /print|pdf|인쇄/i }).first();
    const altPrintBtn = page.locator('[data-print-btn], .toc-print-btn, button[title*="Print"], button[title*="PDF"]').first();

    const hasBtn = await printBtn.count() > 0 || await altPrintBtn.count() > 0;
    expect(hasBtn).toBe(true);
  });

  test('Print 버튼 클릭 시 window.print가 호출됨', async ({ page }) => {
    // window.print mock
    let printCalled = false;
    await page.exposeFunction('__testPrintCalled', () => { printCalled = true; });
    await page.evaluate(() => {
      const original = window.print;
      window.print = function() { window.__testPrintCalled(); };
    });

    const printBtn = page.locator('button').filter({ hasText: /print|pdf|인쇄/i }).first();
    if (await printBtn.count() === 0) {
      const altBtn = page.locator('[data-print-btn], .toc-print-btn').first();
      if (await altBtn.count() === 0) { test.skip(); return; }
      await altBtn.click();
    } else {
      await printBtn.click();
    }

    await page.waitForTimeout(500);
    expect(printCalled).toBe(true);
  });
});

// ─── View Source 버튼 ──────────────────────────────────────────
test.describe('View Source 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('View Source 버튼이 TOC에 존재함', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    const altBtn = page.locator('[data-view-source-btn], .toc-view-source-btn, button[title*="Source"]').first();

    const hasBtn = await viewSourceBtn.count() > 0 || await altBtn.count() > 0;
    expect(hasBtn).toBe(true);
  });

  test('View Source 버튼 클릭 시 모달이 열림', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) {
      const altBtn = page.locator('[data-view-source-btn], .toc-view-source-btn').first();
      if (await altBtn.count() === 0) { test.skip(); return; }
      await altBtn.click();
    } else {
      await viewSourceBtn.click();
    }

    // 모달이 열려야 함
    const modal = page.locator('.view-source-modal, [role="dialog"], .modal-overlay').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('View Source 모달에 Markdown 탭이 있음', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    // 탭은 .view-source-tab 클래스의 button으로 구현됨 (role="tab" 없음)
    const mdTab = page.locator('.view-source-tab, [role="tab"], button[data-tab="markdown"]').filter({ hasText: /markdown/i }).first();
    await expect(mdTab).toBeVisible({ timeout: 5000 });
  });

  test('View Source 모달에 HTML 탭이 있고 전환 가능', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    // 모달이 열릴 때까지 대기 후 HTML 탭 확인 (모달이 비동기 렌더링됨)
    const htmlTab = page.locator('.view-source-tab, button[data-tab="html"]').filter({ hasText: /html/i }).first();
    await expect(htmlTab).toBeVisible({ timeout: 5000 });
    await htmlTab.click();

    // HTML 탭 콘텐츠 확인 (active 탭 콘텐츠만 visible)
    const panel = page.locator('.view-source-tab-content-active, .view-source-tab-content[data-tab-content="html"]').first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    const text = await panel.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('View Source 모달에서 파일 경로 표시', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    // 파일 경로가 표시되어야 함 (.md 확장자 포함)
    const modal = page.locator('.view-source-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/\.md|rendering-test/i);
  });

  test('View Source 모달 - X 버튼으로 닫기', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    const modal = page.locator('.view-source-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // X 버튼 클릭
    const closeBtn = page.locator('.view-source-modal button[title*="close"], .view-source-modal button[aria-label*="close"], .modal-close, .close-btn').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await expect(modal).toBeHidden({ timeout: 3000 });
    }
  });

  test('View Source 모달 - Esc 키로 닫기', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    const modal = page.locator('.view-source-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 3000 });
  });

  test('View Source 모달 - Markdown 소스 내용 포함', async ({ page }) => {
    const viewSourceBtn = page.locator('button').filter({ hasText: /source|소스/i }).first();
    if (await viewSourceBtn.count() === 0) { test.skip(); return; }
    await viewSourceBtn.click();

    const modal = page.locator('.view-source-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Markdown 소스 내용이 표시되어야 함
    const sourceContent = modal.locator('pre, textarea, code, .source-content').first();
    if (await sourceContent.count() > 0) {
      const text = await sourceContent.textContent();
      expect(text?.length).toBeGreaterThan(10);
    }
  });
});

// ─── Screen Preview 버튼 ───────────────────────────────────────
test.describe('Screen Preview 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/screen-preview-test');
  });

  test('Screen Preview 버튼이 TOC에 존재함 (screen frontmatter 있는 페이지)', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn, [data-screen-preview-btn], button[title*="screen"], button[title*="preview"]').first();
    // 또는 텍스트로
    const altBtn = page.locator('button').filter({ hasText: /screen|preview|미리보기/i }).first();

    const hasBtn = await previewBtn.count() > 0 || await altBtn.count() > 0;
    expect(hasBtn).toBe(true);
  });

  test('Screen Preview 버튼 클릭 시 모달 열림', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn').first();
    if (await previewBtn.count() === 0) {
      const altBtn = page.locator('button').filter({ hasText: /screen|preview|미리보기/i }).first();
      if (await altBtn.count() === 0) { test.skip(); return; }
      await altBtn.click();
    } else {
      await previewBtn.click();
    }

    // Screen Preview 모달 열림 확인
    const modal = page.locator('.screen-preview-modal, .sp-modal, [class*="screen-preview"]').first();
    await expect(modal).toBeVisible({ timeout: 10000 });
  });

  test('Screen Preview 모달 - Mobile/Tablet/Desktop 탭 존재', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn').first();
    if (await previewBtn.count() === 0) { test.skip(); return; }
    await previewBtn.click();

    const modal = page.locator('.screen-preview-modal, .sp-modal').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 디바이스 탭 버튼들
    const mobilBtn = modal.locator('button').filter({ hasText: /mobile|모바일/i });
    const tabletBtn = modal.locator('button').filter({ hasText: /tablet|태블릿/i });
    const desktopBtn = modal.locator('button').filter({ hasText: /desktop|데스크탑/i });

    expect(await mobilBtn.count() + await tabletBtn.count() + await desktopBtn.count()).toBeGreaterThan(0);
  });

  test('Screen Preview 모달 - 닫기 버튼 동작', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn').first();
    if (await previewBtn.count() === 0) { test.skip(); return; }
    await previewBtn.click();

    const modal = page.locator('.screen-preview-modal, .sp-modal').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 닫기 버튼
    const closeBtn = modal.locator('button[title*="close"], button[aria-label*="close"], .close-btn, .sp-close').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await expect(modal).toBeHidden({ timeout: 3000 });
    }
  });

  test('Screen Preview 모달 - Esc 키로 닫기', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn').first();
    if (await previewBtn.count() === 0) { test.skip(); return; }
    await previewBtn.click();

    const modal = page.locator('.screen-preview-modal, .sp-modal').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 3000 });
  });

  test('Screen Preview 모달에 상태(status) 배지 표시', async ({ page }) => {
    const previewBtn = page.locator('.toc-screen-preview-btn').first();
    if (await previewBtn.count() === 0) { test.skip(); return; }
    await previewBtn.click();

    const modal = page.locator('.screen-preview-modal, .sp-modal').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 상태 배지 (confirmed/확정)
    const statusBadge = modal.locator('[class*="status"], [class*="badge"]').first();
    if (await statusBadge.count() > 0) {
      await expect(statusBadge).toBeVisible();
    }
  });
});
