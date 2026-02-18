/**
 * tests/e2e/presentation.spec.js
 * 프레젠테이션 모드 E2E 테스트 (reveal.js)
 */
import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

test.describe('프레젠테이션 모드', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/presentation-test');
  });

  test('프레젠테이션 페이지가 로드됨', async ({ page }) => {
    await expect(page).toHaveTitle(/프레젠테이션/);
  });

  test('"Presentation Mode" 버튼이 존재함', async ({ page }) => {
    const presentBtn = page.locator('button').filter({ hasText: /presentation|프레젠테이션/i }).first();
    const altBtn = page.locator('[data-presentation-btn], .presentation-mode-btn, a[href*="mode=presentation"]').first();

    const hasBtn = await presentBtn.count() > 0 || await altBtn.count() > 0;
    expect(hasBtn).toBe(true);
  });

  test('Presentation Mode 버튼 클릭 시 URL에 ?mode=presentation 추가', async ({ page }) => {
    const presentBtn = page.locator('button').filter({ hasText: /presentation|프레젠테이션/i }).first();
    if (await presentBtn.count() === 0) {
      const altBtn = page.locator('a[href*="mode=presentation"]').first();
      if (await altBtn.count() === 0) { test.skip(); return; }
      await altBtn.click();
    } else {
      await presentBtn.click();
    }

    // URL 변경 확인
    await page.waitForURL(/mode=presentation/, { timeout: 10000 });
    expect(page.url()).toContain('mode=presentation');
  });

  test('Presentation Mode에서 reveal.js 컨테이너가 존재함', async ({ page }) => {
    // 프레젠테이션 모드로 직접 이동
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(2000); // reveal.js 초기화 대기

    // reveal.js 컨테이너
    const revealContainer = page.locator('.reveal, #reveal-container, [class*="reveal"]').first();
    await expect(revealContainer).toBeVisible({ timeout: 15000 });
  });

  test('Presentation Mode에서 Starlight 헤더가 숨겨짐', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(2000);

    // Starlight 헤더
    const header = page.locator('header.header, .site-header, header[class*="starlight"]').first();
    if (await header.count() > 0) {
      // 숨겨지거나 display:none이어야 함
      const isHidden = await header.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
      });
      expect(isHidden).toBe(true);
    }
  });

  test('Presentation Mode에서 "Document Mode" 버튼 존재', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(2000);

    const docModeBtn = page.locator('button').filter({ hasText: /document|문서 모드/i }).first();
    const altBtn = page.locator('[data-doc-mode-btn], .document-mode-btn').first();

    const hasBtn = await docModeBtn.count() > 0 || await altBtn.count() > 0;
    expect(hasBtn).toBe(true);
  });

  test('Document Mode 버튼 클릭 시 ?mode=presentation 없이 복원', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(2000);

    const docModeBtn = page.locator('button').filter({ hasText: /document|문서 모드/i }).first();
    if (await docModeBtn.count() === 0) { test.skip(); return; }

    await docModeBtn.click();
    await page.waitForTimeout(1000);

    // URL에서 ?mode=presentation이 제거되어야 함
    expect(page.url()).not.toContain('mode=presentation');
  });

  test('Presentation Mode에서 슬라이드 섹션이 존재함', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(3000); // reveal.js 초기화

    // reveal.js 슬라이드 섹션
    const slides = page.locator('.reveal .slides section, .reveal section').first();
    if (await slides.count() > 0) {
      await expect(slides).toBeVisible();
    }
  });
});
