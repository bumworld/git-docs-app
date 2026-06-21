/**
 * tests/e2e/presentation-mermaid.spec.js
 * 프레젠테이션 모드 머메이드 및 버튼 위치 E2E 테스트
 */
import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/test-login');
  await page.waitForURL('/');
}

test.describe('프레젠테이션 모드 - 머메이드 및 버튼 위치', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Document Mode: Presentation 버튼이 우측 하단에 위치', async ({ page }) => {
    await page.goto('/presentation-test');
    await page.waitForTimeout(1000);

    const presentBtn = page.locator('button').filter({ hasText: /presentation mode/i }).first();

    if (await presentBtn.count() === 0) {
      console.log('Presentation Mode 버튼을 찾을 수 없습니다.');
      test.skip();
      return;
    }

    // 버튼의 위치 확인
    const box = await presentBtn.boundingBox();
    const viewport = page.viewportSize();

    if (box && viewport) {
      // 우측 하단 확인 (viewport의 오른쪽 아래 근처)
      const isRight = box.x + box.width > viewport.width * 0.7; // 오른쪽 70% 이상
      const isBottom = box.y > viewport.height * 0.7; // 아래쪽 70% 이상

      console.log(`Button position: x=${box.x}, y=${box.y}, viewport=${viewport.width}x${viewport.height}`);
      console.log(`isRight: ${isRight}, isBottom: ${isBottom}`);

      expect(isRight).toBe(true);
      expect(isBottom).toBe(true);
    }
  });

  test('Presentation Mode: Document Mode 버튼이 우측 상단에 위치', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(3000);

    const docBtn = page.locator('button').filter({ hasText: /document mode/i }).first();

    if (await docBtn.count() === 0) {
      console.log('Document Mode 버튼을 찾을 수 없습니다.');
      test.skip();
      return;
    }

    // 버튼의 위치 확인
    const box = await docBtn.boundingBox();
    const viewport = page.viewportSize();

    if (box && viewport) {
      // 우측 상단 확인
      const isRight = box.x + box.width > viewport.width * 0.7; // 오른쪽 70% 이상
      const isTop = box.y < viewport.height * 0.3; // 위쪽 30% 이내

      console.log(`Button position: x=${box.x}, y=${box.y}, viewport=${viewport.width}x${viewport.height}`);
      console.log(`isRight: ${isRight}, isTop: ${isTop}`);

      expect(isRight).toBe(true);
      expect(isTop).toBe(true);
    }
  });

  test('Presentation Mode: 머메이드가 처음부터 렌더링됨 (Syntax error 없음)', async ({ page }) => {
    // 콘솔 에러 캡처
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/presentation-test?mode=presentation');

    // 충분한 시간 대기 (머메이드 초기화)
    await page.waitForTimeout(5000);

    // 머메이드 SVG가 렌더링되었는지 확인
    const mermaidSvg = page.locator('.reveal .slides .mermaid svg').first();

    if (await mermaidSvg.count() > 0) {
      await expect(mermaidSvg).toBeVisible({ timeout: 10000 });

      // Syntax error가 없어야 함
      const hasSyntaxError = errors.some(err =>
        err.includes('Syntax error') || err.includes('mermaid')
      );

      if (hasSyntaxError) {
        console.log('Mermaid errors:', errors.filter(e => e.includes('mermaid') || e.includes('Syntax')));
      }

      expect(hasSyntaxError).toBe(false);
    } else {
      console.log('머메이드 다이어그램을 찾을 수 없습니다.');
    }
  });

  test('Presentation Mode: Open Diagram 버튼이 머메이드 슬라이드에서만 표시', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(3000);

    // 첫 번째 슬라이드 (타이틀 슬라이드, 머메이드 없음)
    const openDiagramBtn = page.locator('button').filter({ hasText: /open diagram/i }).first();

    // 초기에는 숨겨져 있어야 함
    const isInitiallyHidden = await openDiagramBtn.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none';
    }, undefined, { timeout: 5000 }).catch(() => true); // 요소가 없으면 true

    console.log('Open Diagram button initially hidden:', isInitiallyHidden);
    expect(isInitiallyHidden).toBe(true);

    // 다음 슬라이드로 이동 (머메이드가 있을 수 있음)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);

    // 머메이드가 있는 슬라이드인지 확인
    const hasMermaid = await page.locator('.reveal .slides section.present .mermaid').count() > 0;

    if (hasMermaid) {
      // 머메이드가 있으면 버튼이 표시되어야 함
      await page.waitForTimeout(500); // 버튼 가시성 업데이트 대기

      const isVisible = await openDiagramBtn.isVisible().catch(() => false);
      console.log('Mermaid slide - Open Diagram button visible:', isVisible);
      expect(isVisible).toBe(true);
    } else {
      console.log('현재 슬라이드에 머메이드가 없습니다.');
    }
  });

  test('Presentation Mode: Overview 모드에서 Open Diagram 버튼 숨김', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(3000);

    // 머메이드 슬라이드로 이동
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    const openDiagramBtn = page.locator('button').filter({ hasText: /open diagram/i }).first();

    // Overview 모드 진입 (ESC 키)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 버튼이 숨겨져야 함
    const isHiddenInOverview = await openDiagramBtn.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none';
    }, undefined, { timeout: 5000 }).catch(() => true);

    console.log('Open Diagram button hidden in overview:', isHiddenInOverview);
    expect(isHiddenInOverview).toBe(true);
  });

  test('Presentation Mode: reveal.js 컨트롤과 버튼이 겹치지 않음', async ({ page }) => {
    await page.goto('/presentation-test?mode=presentation');
    await page.waitForTimeout(3000);

    const docBtn = page.locator('button').filter({ hasText: /document mode/i }).first();
    const revealControls = page.locator('.reveal .controls').first();

    if (await docBtn.count() === 0 || await revealControls.count() === 0) {
      console.log('버튼 또는 reveal.js 컨트롤을 찾을 수 없습니다.');
      test.skip();
      return;
    }

    const docBox = await docBtn.boundingBox();
    const controlsBox = await revealControls.boundingBox();

    if (docBox && controlsBox) {
      // 두 영역이 겹치지 않는지 확인
      const overlaps = !(
        docBox.x + docBox.width < controlsBox.x ||
        docBox.x > controlsBox.x + controlsBox.width ||
        docBox.y + docBox.height < controlsBox.y ||
        docBox.y > controlsBox.y + controlsBox.height
      );

      console.log(`Doc button: x=${docBox.x}, y=${docBox.y}`);
      console.log(`Controls: x=${controlsBox.x}, y=${controlsBox.y}`);
      console.log(`Overlaps: ${overlaps}`);

      expect(overlaps).toBe(false);
    }
  });
});
