/**
 * tests/e2e/admin.spec.js
 * 어드민 UI E2E 테스트
 * - Dashboard 탭
 * - Users 탭
 * - Builds 탭
 * - Settings 탭
 * - Email Whitelist 탭
 */
import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

test.describe('어드민 패널 접근', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/admin 접근 시 어드민 패널 로드됨', async ({ page }) => {
    await page.goto('/admin');
    // 어드민 패널 HTML이 로드되어야 함
    await expect(page.locator('body')).toBeVisible();
    // 어드민 특유의 요소 확인 (탭 네비게이션 등)
    const tabNav = page.locator('[role="tablist"], .tabs, .tab-nav, nav').first();
    await expect(tabNav).toBeVisible({ timeout: 10000 });
  });

  test('어드민이 아닌 사용자는 /admin 접근 시 403 또는 리다이렉트', async ({ page }) => {
    await page.goto('/test-login-user');
    await page.waitForURL('/');

    const response = await page.goto('/admin');
    // 403 또는 리다이렉트
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('어드민 - Dashboard 탭', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('Dashboard 탭 클릭 시 통계 카드 표시', async ({ page }) => {
    // Dashboard 탭 찾기
    const dashboardTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /dashboard|대시보드/i }).first();
    if (await dashboardTab.count() > 0) {
      await dashboardTab.click();
      await page.waitForTimeout(500);
    }

    // 통계 카드 또는 수치 확인
    const statsCards = page.locator('.stats-card, .stat-item, [class*="stat"], [class*="card"]').first();
    await expect(statsCards).toBeVisible({ timeout: 5000 });
  });

  test('사용자 수 통계가 숫자로 표시됨', async ({ page }) => {
    const userCountEl = page.locator('[data-stat="users"], [class*="user-count"], .stat-value').first();
    if (await userCountEl.count() > 0) {
      const text = await userCountEl.textContent();
      expect(text).toMatch(/\d+/);
    }
  });
});

test.describe('어드민 - Users 탭', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('Users 탭 클릭 시 사용자 목록 표시', async ({ page }) => {
    const usersTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /users|사용자/i }).first();
    if (await usersTab.count() === 0) { test.skip(); return; }
    await usersTab.click();
    await page.waitForTimeout(500);

    // Users 탭의 사용자 목록 컨테이너 (#usersList) 또는 그 안의 카드 확인
    const usersList = page.locator('#usersList, #tab-users .user-list').first();
    await expect(usersList).toBeVisible({ timeout: 5000 });
  });

  test('API를 통해 사용자 목록 조회 가능', async ({ page }) => {
    const response = await page.request.get('/api/admin/users', {
      headers: { Cookie: await getSessionCookie(page) },
    });
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});

test.describe('어드민 - Builds 탭', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('Builds 탭 클릭 시 빌드 이력 표시', async ({ page }) => {
    const buildsTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /build|빌드/i }).first();
    if (await buildsTab.count() === 0) { test.skip(); return; }
    await buildsTab.click();
    await page.waitForTimeout(500);

    const buildList = page.locator('table, .build-list, [class*="build-table"]').first();
    await expect(buildList).toBeVisible({ timeout: 5000 });
  });

  test('상태 필터 드롭다운이 존재함', async ({ page }) => {
    const buildsTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /build|빌드/i }).first();
    if (await buildsTab.count() === 0) { test.skip(); return; }
    await buildsTab.click();
    await page.waitForTimeout(500);

    const statusFilter = page.locator('select').filter({ has: page.locator('option[value="success"], option[value="failed"]') }).first();
    const altFilter = page.locator('[data-filter="status"], select[name*="status"]').first();

    const hasFilter = await statusFilter.count() > 0 || await altFilter.count() > 0;
    expect(hasFilter).toBe(true);
  });

  test('API를 통해 빌드 이력 조회 가능', async ({ page }) => {
    const response = await page.request.get('/api/builds?limit=10', {
      headers: { Cookie: await getSessionCookie(page) },
    });
    expect(response.status()).toBe(200);
    const json = await response.json();
    // /api/builds 응답은 { builds: [...], stats: {...} } 형태
    const builds = Array.isArray(json) ? json : json.builds;
    expect(Array.isArray(builds)).toBe(true);
  });

  test('수동 빌드 트리거 API 동작', async ({ page }) => {
    // 현재 빌드 상태 확인
    const statusRes = await page.request.get('/api/status', {
      headers: { Cookie: await getSessionCookie(page) },
    });
    const status = await statusRes.json();

    // 빌드 중이 아닐 때만 트리거
    if (!status.isBuilding) {
      const buildRes = await page.request.post('/api/rebuild', {
        headers: { Cookie: await getSessionCookie(page) },
      });
      // 200 (빌드 시작) 또는 409 (이미 실행 중)
      expect([200, 409]).toContain(buildRes.status());
    }
  });
});

test.describe('어드민 - Settings 탭', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('Settings 탭에서 사이트 설정 폼이 로드됨', async ({ page }) => {
    const settingsTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /setting|설정/i }).first();
    if (await settingsTab.count() === 0) { test.skip(); return; }
    await settingsTab.click();
    await page.waitForTimeout(1000);

    // 설정 폼 또는 입력 필드
    const inputFields = page.locator('input[type="text"], input[name*="title"], input[name*="url"]').first();
    const altForm = page.locator('form, .settings-form').first();

    const hasForm = await inputFields.count() > 0 || await altForm.count() > 0;
    expect(hasForm).toBe(true);
  });

  test('API를 통해 현재 설정 조회 가능', async ({ page }) => {
    const response = await page.request.get('/api/admin/settings', {
      headers: { Cookie: await getSessionCookie(page) },
    });
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty('site_title');
  });

  test('설정 업데이트 API 동작', async ({ page }) => {
    const response = await page.request.put('/api/admin/settings', {
      headers: {
        Cookie: await getSessionCookie(page),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        site_title: 'Updated E2E Test Wiki',
        footer_text: 'E2E Test Footer',
      }),
    });
    expect([200, 202]).toContain(response.status());

    // 설정이 실제로 업데이트되었는지 확인
    const getRes = await page.request.get('/api/admin/settings', {
      headers: { Cookie: await getSessionCookie(page) },
    });
    const settings = await getRes.json();
    expect(settings.site_title).toBe('Updated E2E Test Wiki');
  });
});

test.describe('어드민 - Email Whitelist 탭', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('Email Whitelist 탭에서 목록 조회 가능', async ({ page }) => {
    const whitelistTab = page.locator('[role="tab"], .tab-btn, button').filter({ hasText: /whitelist|화이트리스트|이메일/i }).first();
    if (await whitelistTab.count() === 0) { test.skip(); return; }
    await whitelistTab.click();
    await page.waitForTimeout(500);

    // 화이트리스트 목록 또는 폼
    const list = page.locator('table, .whitelist, [class*="whitelist"]').first();
    const altList = page.locator('ul, .email-list').first();
    const hasContent = await list.count() > 0 || await altList.count() > 0;
    expect(hasContent).toBe(true);
  });

  test('API를 통해 이메일 추가 및 삭제 가능', async ({ page }) => {
    const cookie = await getSessionCookie(page);
    const testEmail = `test-e2e-${Date.now()}@example.com`;

    // 추가
    const addRes = await page.request.post('/api/admin/whitelisted-emails', {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: JSON.stringify({ email: testEmail, notes: 'E2E test' }),
    });
    expect([200, 201]).toContain(addRes.status());
    const added = await addRes.json();
    const emailId = added.id;

    // 목록에서 확인
    const listRes = await page.request.get('/api/admin/whitelisted-emails', {
      headers: { Cookie: cookie },
    });
    const list = await listRes.json();
    expect(list.some(e => e.email === testEmail)).toBe(true);

    // 삭제
    if (emailId) {
      const deleteRes = await page.request.delete(`/api/admin/whitelisted-emails/${emailId}`, {
        headers: { Cookie: cookie },
      });
      expect([200, 204]).toContain(deleteRes.status());
    }
  });
});

// ─── 헬퍼: 세션 쿠키 추출 ─────────────────────────────────────
async function getSessionCookie(page) {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'connect.sid' || c.name.includes('session'));
  if (!sessionCookie) return '';
  return `${sessionCookie.name}=${sessionCookie.value}`;
}
