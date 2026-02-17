---
title: End-to-End Testing Guide
sidebar:
  label: E2E Testing
---

# End-to-End Testing Guide

## Overview

E2E tests verify complete user workflows from the browser perspective using Playwright.

## Test Structure

### Page Object Model

Organize tests using the Page Object pattern for maintainability.

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage() {
    return this.page.textContent('[data-testid="error-message"]');
  }
}

// tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@example.com', 'password123');

    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('invalid@example.com', 'wrong');

    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Invalid credentials');
  });
});
```

---

## Best Practices

### 1. Use Data Test IDs

Use `data-testid` attributes for stable selectors.

```tsx
// Component
<button data-testid="submit-button">Submit</button>

// Test
await page.click('[data-testid="submit-button"]');
```

### 2. Wait for Network Requests

```typescript
// Wait for API response
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/users')),
  page.click('[data-testid="load-users"]')
]);
```

### 3. Setup and Teardown

```typescript
test.beforeEach(async ({ page }) => {
  // Clear cookies and local storage
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
});

test.afterEach(async ({ page }, testInfo) => {
  // Take screenshot on failure
  if (testInfo.status !== 'passed') {
    await page.screenshot({
      path: `screenshots/${testInfo.title}.png`
    });
  }
});
```

### 4. Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
});
```

---

## Common Patterns

### Authentication Helper

```typescript
// helpers/auth.ts
export async function loginAsUser(page: Page, role: 'admin' | 'user') {
  const credentials = {
    admin: { email: 'admin@example.com', password: 'admin123' },
    user: { email: 'user@example.com', password: 'user123' }
  };

  await page.goto('/login');
  await page.fill('[data-testid="email"]', credentials[role].email);
  await page.fill('[data-testid="password"]', credentials[role].password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

// Usage in test
test('admin can access settings', async ({ page }) => {
  await loginAsUser(page, 'admin');
  await page.goto('/settings');
  await expect(page.locator('h1')).toHaveText('Settings');
});
```

### Visual Regression Testing

```typescript
test('homepage looks correct', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100
  });
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Debugging

### Debug Mode

```bash
# Run tests in headed mode with inspector
npx playwright test --headed --debug

# Run specific test
npx playwright test auth.spec.ts --headed

# Trace viewer
npx playwright show-trace trace.zip
```

### Console Logs

```typescript
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  await page.goto('/');
});
```
