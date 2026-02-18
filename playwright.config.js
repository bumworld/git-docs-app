// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 테스트 설정
 * - 테스트 서버: localhost:3001 (NODE_ENV=test)
 * - 브라우저: Chromium (headless)
 * - globalSetup: DB 초기화 + 픽스처 배포 + prebuild + Astro build
 * - webServer: NODE_ENV=test 서버 기동
 * - globalTeardown: 파일 복원
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',

  // 각 테스트의 최대 실행 시간
  timeout: 60000,

  expect: {
    timeout: 15000,
  },

  // 서버 공유로 병렬 실행 비활성화
  fullyParallel: false,
  workers: 1,

  // 실패 시 재시도 (CI에서만)
  retries: process.env.CI ? 2 : 0,

  // 리포터
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // globalSetup에서 prebuild + Astro build를 완료한 후
  // webServer는 단순히 서버만 시작
  webServer: {
    command: 'PORT=3001 NODE_ENV=test SESSION_SECRET=e2e-test-secret-12345 ADMIN_EMAIL=admin@test.com node server/index.js',
    port: 3001,
    timeout: 60000,
    reuseExistingServer: !process.env.CI,
  },

  globalSetup: './tests/e2e/global-setup.js',
  globalTeardown: './tests/e2e/global-teardown.js',
});
