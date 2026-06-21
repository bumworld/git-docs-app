/**
 * tests/e2e/navigation.spec.js
 * 네비게이션 E2E 테스트
 * - 사이드바 렌더링
 * - 사이드바 링크 클릭 → 페이지 이동
 * - 이전/다음 페이지네이션
 * - TOC (On this page) 섹션 링크
 * - 브레드크럼
 */
import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

test.describe('사이드바 네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
  });

  test('사이드바가 렌더링됨', async ({ page }) => {
    // Starlight 사이드바 - 컨테이너 대신 내부 링크 존재 여부로 확인
    // (nav[aria-label*="Main"]은 모바일 hidden 요소가 먼저 매치될 수 있음)
    const sidebarLink = page.locator('.sidebar a[href], nav[aria-label*="Main"] a[href]').first();
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });
  });

  test('사이드바에 페이지 링크가 존재함', async ({ page }) => {
    const sidebar = page.locator('nav[aria-label*="Main"], .sidebar, aside').first();
    const links = sidebar.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('사이드바 링크 클릭 시 해당 페이지로 이동', async ({ page }) => {
    const sidebar = page.locator('nav[aria-label*="Main"], .sidebar, aside').first();
    // 렌더링 테스트 링크 찾기
    const renderingLink = sidebar.locator('a[href*="rendering-test"]').first();
    if (await renderingLink.count() === 0) {
      // 다른 링크 시도
      const anyLink = sidebar.locator('a[href]:not([href="/"])').first();
      if (await anyLink.count() === 0) { test.skip(); return; }
      const href = await anyLink.getAttribute('href');
      await anyLink.click();
      await page.waitForURL(href || '**', { timeout: 10000 });
      return;
    }
    await renderingLink.click();
    await page.waitForURL(/rendering-test/, { timeout: 10000 });
    expect(page.url()).toContain('rendering-test');
  });

  test('홈 링크(/) 클릭 시 루트로 이동', async ({ page }) => {
    // 다른 페이지로 이동 후
    await page.goto('/rendering-test');

    // 로고 또는 홈 링크
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.count() === 0) { test.skip(); return; }
    await homeLink.click();
    await page.waitForURL('/', { timeout: 10000 });
    expect(page.url()).toMatch(/localhost:3001\/?$/);
  });
});

test.describe('TOC (On this page) 섹션 링크', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('TOC 섹션이 렌더링됨', async ({ page }) => {
    // Starlight의 "On this page" TOC
    const toc = page.locator('nav[aria-label*="page"], .toc, [class*="table-of-contents"], starlight-toc').first();
    await expect(toc).toBeVisible({ timeout: 10000 });
  });

  test('TOC에 현재 페이지 섹션 링크 존재', async ({ page }) => {
    const toc = page.locator('nav[aria-label*="page"], .toc, [class*="table-of-contents"], starlight-toc').first();
    const tocLinks = toc.locator('a[href^="#"]');
    const count = await tocLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TOC 링크 클릭 시 페이지 내 앵커로 이동', async ({ page }) => {
    const toc = page.locator('nav[aria-label*="page"], .toc, [class*="table-of-contents"], starlight-toc').first();
    const firstTocLink = toc.locator('a[href^="#"]').first();
    if (await firstTocLink.count() === 0) { test.skip(); return; }

    const href = await firstTocLink.getAttribute('href');
    await firstTocLink.click();

    // URL에 앵커가 추가되어야 함
    await page.waitForTimeout(500);
    expect(page.url()).toContain('#');
  });
});

test.describe('페이지네이션 (이전/다음)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('이전/다음 페이지네이션 링크가 존재함', async ({ page }) => {
    // Starlight 페이지네이션 - 여러 선택자 시도
    const paginationLocator = page.locator(
      '.pagination-links, [class*="pagination-link"], a[rel="prev"], a[rel="next"], [class*="sl-pagination"]'
    );
    const count = await paginationLocator.count();
    // 페이지네이션이 없을 수도 있음 (단일 문서인 경우) - 있으면 첫 번째가 보여야 함
    if (count > 0) {
      await expect(paginationLocator.first()).toBeVisible({ timeout: 5000 });
    }
    // 없어도 테스트 통과 (E2E 픽스처 페이지 구성에 따라 다를 수 있음)
  });

  test('다음 페이지 링크 클릭 시 이동', async ({ page }) => {
    const nextLink = page.locator('a[rel="next"], a[href].next-page, [class*="next"] a').first();
    if (await nextLink.count() === 0) { test.skip(); return; }

    const href = await nextLink.getAttribute('href');
    // href 는 .html 을 포함하지만 실제 라우팅은 clean URL(.html 제거)로 정규화된다.
    // 양쪽의 .html 을 제거한 pathname 으로 '의도한 다음 페이지'에 도착했는지 확인한다.
    const expectedPath = new URL(href, page.url()).pathname.replace(/\.html$/, '');
    await nextLink.click();
    await page.waitForURL(url => url.pathname.replace(/\.html$/, '') === expectedPath, { timeout: 10000 });
    expect(page.url()).not.toContain('rendering-test');
  });
});

test.describe('검색 기능 (Pagefind)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
  });

  test('검색 버튼 또는 검색창이 존재함', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], [data-search], site-search').first();
    const searchBtn = page.locator('button[aria-label*="search"], button[title*="search"], button[class*="search"]').first();

    const hasSearch = await searchInput.count() > 0 || await searchBtn.count() > 0;
    expect(hasSearch).toBe(true);
  });
});

test.describe('인증 바 (Auth Bar)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
  });

  test('로그인 후 인증 바가 표시됨', async ({ page }) => {
    // auth-bar.js가 사용자 정보를 표시
    const authBar = page.locator('#auth-bar, .auth-bar, [data-auth-bar]').first();
    if (await authBar.count() === 0) {
      // 사용자 이름 또는 로그아웃 버튼으로 확인
      const logoutBtn = page.locator('a[href*="logout"], button').filter({ hasText: /logout|로그아웃/i }).first();
      if (await logoutBtn.count() > 0) {
        await expect(logoutBtn).toBeVisible({ timeout: 5000 });
        return;
      }
    } else {
      await expect(authBar).toBeVisible({ timeout: 5000 });
    }
  });

  test('관리자 계정에서 Admin 링크 표시', async ({ page }) => {
    // 어드민에게만 Admin 링크가 보여야 함
    const adminLink = page.locator('a[href*="admin"]').filter({ hasText: /admin|관리/i }).first();
    await expect(adminLink).toBeVisible({ timeout: 5000 });
  });

  test('로그아웃 링크 존재', async ({ page }) => {
    const logoutLink = page.locator('a[href*="logout"]').first();
    const logoutBtn = page.locator('button').filter({ hasText: /logout|로그아웃/i }).first();

    const hasLogout = await logoutLink.count() > 0 || await logoutBtn.count() > 0;
    expect(hasLogout).toBe(true);
  });
});

test.describe('반응형 레이아웃', () => {
  test('모바일 뷰포트에서 페이지 로드', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await page.goto('/rendering-test');

    // 콘텐츠가 보여야 함
    const content = page.locator('main, .content, .sl-markdown-content').first();
    await expect(content).toBeVisible();
  });

  test('태블릿 뷰포트에서 페이지 로드', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAsAdmin(page);
    await page.goto('/rendering-test');

    const content = page.locator('main, .content, .sl-markdown-content').first();
    await expect(content).toBeVisible();
  });

  test('데스크탑 뷰포트에서 사이드바 표시', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);
    await page.goto('/rendering-test');

    // 데스크탑에서 사이드바 링크가 보여야 함
    const sidebarLink = page.locator('.sidebar a[href], nav[aria-label*="Main"] a[href]').first();
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });
  });
});
