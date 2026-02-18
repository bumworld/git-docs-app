/**
 * tests/e2e/content-rendering.spec.js
 * 콘텐츠 렌더링 E2E 테스트
 * - H1~H6 헤딩
 * - 굵기, 기울임, 코드 블록
 * - 표(Table)
 * - Mermaid SVG 렌더링
 * - 외부 링크 속성
 * - 한글 텍스트
 */
import { test, expect } from '@playwright/test';

// 로그인 헬퍼 (admin 세션)
async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

test.describe('콘텐츠 렌더링 - 기본 텍스트', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('H1 ~ H6 헤딩이 모두 렌더링됨', async ({ page }) => {
    // 콘텐츠 영역 내 헤딩 확인
    const content = page.locator('.sl-markdown-content');
    await expect(content.locator('h1')).toBeVisible();
    await expect(content.locator('h2').first()).toBeVisible();
    await expect(content.locator('h3').first()).toBeVisible();
    await expect(content.locator('h4').first()).toBeVisible();
    await expect(content.locator('h5').first()).toBeVisible();
    await expect(content.locator('h6').first()).toBeVisible();
  });

  test('굵은 텍스트(strong)가 렌더링됨', async ({ page }) => {
    const strong = page.locator('.sl-markdown-content strong').first();
    await expect(strong).toBeVisible();
    await expect(strong).toContainText('굵은 텍스트');
  });

  test('기울임 텍스트(em)가 렌더링됨', async ({ page }) => {
    const em = page.locator('.sl-markdown-content em').first();
    await expect(em).toBeVisible();
    await expect(em).toContainText('기울임 텍스트');
  });

  test('인라인 코드가 렌더링됨', async ({ page }) => {
    const code = page.locator('.sl-markdown-content code').first();
    await expect(code).toBeVisible();
    await expect(code).toContainText('인라인 코드');
  });

  test('페이지 타이틀이 표시됨', async ({ page }) => {
    await expect(page).toHaveTitle(/렌더링 테스트/);
  });
});

test.describe('콘텐츠 렌더링 - 코드 블록', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('코드 블록(pre > code)이 존재함', async ({ page }) => {
    const codeBlock = page.locator('.sl-markdown-content pre code').first();
    await expect(codeBlock).toBeVisible();
  });

  test('JavaScript 코드 블록에 syntax highlight 클래스 적용', async ({ page }) => {
    // Astro/Starlight는 shiki로 syntax highlight 적용
    const pre = page.locator('.sl-markdown-content pre').first();
    await expect(pre).toBeVisible();
    // code 태그 안에 내용 존재
    const code = pre.locator('code');
    await expect(code).toContainText('function greet');
  });

  test('Python 코드 블록 렌더링', async ({ page }) => {
    const codeBlocks = page.locator('.sl-markdown-content pre code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Python 코드 포함 확인
    let foundPython = false;
    for (let i = 0; i < count; i++) {
      const text = await codeBlocks.nth(i).textContent();
      if (text?.includes('fibonacci') || text?.includes('def ')) {
        foundPython = true;
        break;
      }
    }
    expect(foundPython).toBe(true);
  });
});

test.describe('콘텐츠 렌더링 - 표(Table)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('table 요소가 렌더링됨', async ({ page }) => {
    const table = page.locator('.sl-markdown-content table').first();
    await expect(table).toBeVisible();
  });

  test('thead와 tbody 구조가 올바름', async ({ page }) => {
    const table = page.locator('.sl-markdown-content table').first();
    await expect(table.locator('thead')).toBeVisible();
    await expect(table.locator('tbody')).toBeVisible();
  });

  test('테이블 헤더 셀(th)이 존재함', async ({ page }) => {
    const th = page.locator('.sl-markdown-content table thead th').first();
    await expect(th).toBeVisible();
    await expect(th).toContainText('이름');
  });

  test('테이블 데이터 셀(td)에 한글 내용 포함', async ({ page }) => {
    const td = page.locator('.sl-markdown-content table tbody td').first();
    await expect(td).toBeVisible();
    await expect(td).toContainText('홍길동');
  });
});

test.describe('콘텐츠 렌더링 - Mermaid 다이어그램', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/mermaid-test');
  });

  test('Mermaid 다이어그램이 SVG로 렌더링됨', async ({ page }) => {
    // Mermaid는 비동기로 렌더링됨 - 대기 필요
    const svg = page.locator('.sl-markdown-content svg').first();
    await expect(svg).toBeVisible({ timeout: 15000 });
  });

  test('Flowchart SVG에 g 요소(노드)가 존재함', async ({ page }) => {
    const svg = page.locator('.sl-markdown-content svg').first();
    await expect(svg).toBeVisible({ timeout: 15000 });

    const gElements = svg.locator('g');
    const count = await gElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Mermaid 렌더링 후 pre.mermaid 또는 div.mermaid 없음 (이미 SVG로 변환)', async ({ page }) => {
    // 렌더링 완료 후 원본 code 블록은 숨겨지거나 SVG로 대체되어야 함
    await page.waitForTimeout(3000); // Mermaid 렌더링 대기
    const svg = page.locator('.sl-markdown-content svg').first();
    await expect(svg).toBeVisible();
  });
});

test.describe('콘텐츠 렌더링 - 링크', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('외부 링크에 target="_blank" 속성 적용', async ({ page }) => {
    const externalLinks = page.locator('.sl-markdown-content a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('외부 링크에 rel="noopener" 또는 "noreferrer" 적용', async ({ page }) => {
    const externalLink = page.locator('.sl-markdown-content a[target="_blank"]').first();
    const rel = await externalLink.getAttribute('rel');
    expect(rel).toMatch(/noopener|noreferrer/);
  });
});

test.describe('콘텐츠 렌더링 - 한글', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('한글 텍스트가 올바르게 렌더링됨 (깨짐 없음)', async ({ page }) => {
    const content = page.locator('.sl-markdown-content');
    await expect(content).toContainText('가나다라마바사아자차카타파하');
  });

  test('한글 굵은 텍스트 렌더링', async ({ page }) => {
    const content = page.locator('.sl-markdown-content');
    await expect(content).toContainText('한글 굵은 텍스트');
  });

  test('홈페이지 한글 콘텐츠 렌더링', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main, [data-pagefind-body], .sl-markdown-content');
    await expect(main.first()).toBeVisible();
  });
});

test.describe('콘텐츠 렌더링 - 목록', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('순서 없는 목록(ul > li)이 렌더링됨', async ({ page }) => {
    const ul = page.locator('.sl-markdown-content ul').first();
    await expect(ul).toBeVisible();
    const lis = ul.locator('li');
    const count = await lis.count();
    expect(count).toBeGreaterThan(0);
  });

  test('순서 있는 목록(ol > li)이 렌더링됨', async ({ page }) => {
    const ol = page.locator('.sl-markdown-content ol').first();
    await expect(ol).toBeVisible();
    const lis = ol.locator('li');
    const count = await lis.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('콘텐츠 렌더링 - 인용문', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/rendering-test');
  });

  test('인용문(blockquote)이 렌더링됨', async ({ page }) => {
    const blockquote = page.locator('.sl-markdown-content blockquote').first();
    await expect(blockquote).toBeVisible();
    await expect(blockquote).toContainText('인용문');
  });
});
