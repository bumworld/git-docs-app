# 테스트 전략 (Test Strategy)

## 개요

### 테스트 철학
> "빠른 피드백, 높은 신뢰도, 자동화 우선"

### 테스트 목표
- **코드 커버리지**: 80% 이상
- **Critical Path**: 100% 커버리지
- **자동화**: CI/CD 파이프라인 통합
- **성능**: 전체 테스트 10분 이내

## Test Pyramid

```mermaid
graph TB
    subgraph "Test Pyramid"
        E2E[E2E Tests<br/>UI 테스트<br/>5%]
        INT[Integration Tests<br/>API 테스트<br/>15%]
        UNIT[Unit Tests<br/>비즈니스 로직<br/>80%]
    end

    E2E -.->|느림, 비쌈| INT
    INT -.->|중간| UNIT
    UNIT -.->|빠름, 저렴| UNIT

    style E2E fill:#ff6b6b
    style INT fill:#ffd93d
    style UNIT fill:#6bcf7f
```

### 테스트 비율
- **Unit Tests**: 80% (빠른 피드백)
- **Integration Tests**: 15% (API 계약)
- **E2E Tests**: 5% (Critical User Journey)

## Unit Tests

### 대상
- 비즈니스 로직
- 유틸리티 함수
- 데이터 변환
- 검증 로직

### 도구
- **Runner**: Jest
- **Assertion**: expect, jest-extended
- **Mocking**: jest.mock, jest.spyOn

### 예시

#### 1. 비즈니스 로직 테스트
```typescript
// src/services/order/OrderPriceCalculator.ts
export class OrderPriceCalculator {
  calculate(items: OrderItem[], shippingFee: number, coupon?: Coupon): number {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = coupon ? this.applyCoupon(subtotal, coupon) : 0;
    const total = subtotal + shippingFee - discount;

    return Math.max(total, 0); // 음수 방지
  }

  private applyCoupon(subtotal: number, coupon: Coupon): number {
    if (coupon.type === 'percentage') {
      return Math.floor(subtotal * coupon.value / 100);
    } else if (coupon.type === 'fixed') {
      return coupon.value;
    }
    return 0;
  }
}

// src/services/order/OrderPriceCalculator.spec.ts
describe('OrderPriceCalculator', () => {
  let calculator: OrderPriceCalculator;

  beforeEach(() => {
    calculator = new OrderPriceCalculator();
  });

  describe('calculate', () => {
    it('should calculate total without coupon', () => {
      const items = [
        { price: 10000, quantity: 2 },
        { price: 5000, quantity: 1 }
      ];
      const result = calculator.calculate(items, 3000);

      expect(result).toBe(28000); // 20000 + 5000 + 3000
    });

    it('should apply percentage coupon', () => {
      const items = [{ price: 10000, quantity: 1 }];
      const coupon = { type: 'percentage', value: 10 };
      const result = calculator.calculate(items, 0, coupon);

      expect(result).toBe(9000); // 10000 - 1000
    });

    it('should apply fixed amount coupon', () => {
      const items = [{ price: 10000, quantity: 1 }];
      const coupon = { type: 'fixed', value: 3000 };
      const result = calculator.calculate(items, 0, coupon);

      expect(result).toBe(7000); // 10000 - 3000
    });

    it('should not return negative total', () => {
      const items = [{ price: 5000, quantity: 1 }];
      const coupon = { type: 'fixed', value: 10000 };
      const result = calculator.calculate(items, 0, coupon);

      expect(result).toBe(0); // Max(5000 - 10000, 0) = 0
    });
  });
});
```

#### 2. Mock을 활용한 테스트
```typescript
// src/services/notification/EmailService.ts
export class EmailService {
  constructor(
    private smtpClient: SMTPClient,
    private templateEngine: TemplateEngine
  ) {}

  async sendOrderConfirmation(order: Order, user: User): Promise<void> {
    const html = await this.templateEngine.render('order-confirmation', {
      orderNumber: order.orderNumber,
      customerName: user.name,
      items: order.items,
      total: order.total
    });

    await this.smtpClient.send({
      to: user.email,
      subject: `주문이 완료되었습니다 (${order.orderNumber})`,
      html
    });
  }
}

// src/services/notification/EmailService.spec.ts
describe('EmailService', () => {
  let emailService: EmailService;
  let mockSMTPClient: jest.Mocked<SMTPClient>;
  let mockTemplateEngine: jest.Mocked<TemplateEngine>;

  beforeEach(() => {
    mockSMTPClient = {
      send: jest.fn().mockResolvedValue(true)
    } as any;

    mockTemplateEngine = {
      render: jest.fn().mockResolvedValue('<html>...</html>')
    } as any;

    emailService = new EmailService(mockSMTPClient, mockTemplateEngine);
  });

  it('should send order confirmation email', async () => {
    const order = {
      orderNumber: 'ORD-123',
      items: [{ name: 'Product A', price: 10000, quantity: 1 }],
      total: 10000
    };
    const user = { name: '홍길동', email: 'hong@example.com' };

    await emailService.sendOrderConfirmation(order, user);

    expect(mockTemplateEngine.render).toHaveBeenCalledWith('order-confirmation', {
      orderNumber: 'ORD-123',
      customerName: '홍길동',
      items: order.items,
      total: 10000
    });

    expect(mockSMTPClient.send).toHaveBeenCalledWith({
      to: 'hong@example.com',
      subject: '주문이 완료되었습니다 (ORD-123)',
      html: expect.any(String)
    });
  });

  it('should throw error when SMTP fails', async () => {
    mockSMTPClient.send.mockRejectedValue(new Error('SMTP connection failed'));

    const order = { orderNumber: 'ORD-123', items: [], total: 0 };
    const user = { name: '홍길동', email: 'hong@example.com' };

    await expect(emailService.sendOrderConfirmation(order, user))
      .rejects.toThrow('SMTP connection failed');
  });
});
```

### 커버리지 목표

| 모듈 | 목표 커버리지 | 현재 | 상태 |
|------|---------------|------|------|
| Services | 90% | 87% | ⚠️ |
| Controllers | 80% | 82% | ✅ |
| Utilities | 95% | 96% | ✅ |
| Models | 70% | 75% | ✅ |

## Integration Tests

### 대상
- API 엔드포인트
- 데이터베이스 통합
- 외부 서비스 연동

### 도구
- **Runner**: Jest
- **HTTP Client**: supertest
- **Database**: Testcontainers (Docker)

### 예시

#### 1. API 테스트
```typescript
// tests/integration/api/products.test.ts
import request from 'supertest';
import { app } from '@/app';
import { setupTestDB, teardownTestDB } from '@/tests/helpers/database';

describe('Products API', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe('GET /api/products', () => {
    it('should return product list', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ page: 1, size: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          products: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          size: 10
        }
      });

      expect(response.body.data.products[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        price: expect.any(Number),
        image: expect.any(String)
      });
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ category: 'electronics' })
        .expect(200);

      expect(response.body.data.products.every(
        (p: any) => p.category === 'electronics'
      )).toBe(true);
    });

    it('should return 400 for invalid page', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ page: -1 })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: expect.stringContaining('page')
        }
      });
    });
  });

  describe('POST /api/products', () => {
    it('should create a product', async () => {
      const newProduct = {
        name: 'Test Product',
        price: 50000,
        category: 'electronics',
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer valid-token')
        .send(newProduct)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          ...newProduct
        }
      });
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/products')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test' }) // price 누락
        .expect(400);

      expect(response.body.error.message).toContain('price');
    });
  });
});
```

#### 2. 데이터베이스 테스트
```typescript
// tests/integration/repositories/OrderRepository.test.ts
import { OrderRepository } from '@/repositories/OrderRepository';
import { setupTestDB, teardownTestDB, clearDB } from '@/tests/helpers/database';

describe('OrderRepository', () => {
  let repository: OrderRepository;

  beforeAll(async () => {
    await setupTestDB();
    repository = new OrderRepository();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDB();
  });

  describe('create', () => {
    it('should create order with items', async () => {
      const orderData = {
        userId: 'user-123',
        items: [
          { productId: 'prod-1', quantity: 2, price: 10000 },
          { productId: 'prod-2', quantity: 1, price: 5000 }
        ],
        shippingAddress: {
          name: '홍길동',
          phone: '010-1234-5678',
          address: '서울시 강남구...'
        },
        total: 25000
      };

      const order = await repository.create(orderData);

      expect(order).toMatchObject({
        id: expect.any(String),
        orderNumber: expect.stringMatching(/^ORD-\d{8}-\d{4}$/),
        status: 'pending',
        userId: 'user-123',
        total: 25000
      });

      expect(order.items).toHaveLength(2);
    });

    it('should rollback on error', async () => {
      const invalidOrder = {
        userId: 'user-123',
        items: [], // 빈 배열 - 에러
        total: 0
      };

      await expect(repository.create(invalidOrder))
        .rejects.toThrow();

      // DB에 저장되지 않았는지 확인
      const orders = await repository.findAll();
      expect(orders).toHaveLength(0);
    });
  });

  describe('findByUserId', () => {
    it('should return user orders sorted by date', async () => {
      // Seed data
      await repository.create({ userId: 'user-1', items: [...], total: 10000 });
      await repository.create({ userId: 'user-1', items: [...], total: 20000 });
      await repository.create({ userId: 'user-2', items: [...], total: 30000 });

      const orders = await repository.findByUserId('user-1');

      expect(orders).toHaveLength(2);
      expect(orders[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        orders[1].createdAt.getTime()
      );
    });
  });
});
```

### Test Helpers

```typescript
// tests/helpers/database.ts
import { Pool } from 'pg';
import { migrate } from '@/database/migrations';

let pool: Pool;

export async function setupTestDB() {
  pool = new Pool({
    host: 'localhost',
    port: 5433, // Test DB port
    database: 'ecommerce_test',
    user: 'test',
    password: 'test'
  });

  await migrate(pool);
}

export async function teardownTestDB() {
  await pool.end();
}

export async function clearDB() {
  await pool.query('TRUNCATE TABLE orders, order_items, users CASCADE');
}

// tests/helpers/fixtures.ts
export const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides
});

export const createTestProduct = (overrides = {}) => ({
  id: 'prod-123',
  name: 'Test Product',
  price: 10000,
  stock: 100,
  ...overrides
});
```

## E2E Tests

### 대상
- Critical User Journeys
- 결제 플로우
- 회원가입/로그인
- 주문 생성

### 도구
- **Framework**: Playwright
- **Browser**: Chromium, Firefox, WebKit

### 예시

#### 1. 주문 플로우 E2E
```typescript
// e2e/checkout-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete full checkout process', async ({ page }) => {
    // 1. 로그인
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. 상품 검색
    await page.fill('[data-testid="search-input"]', '무선 이어폰');
    await page.press('[data-testid="search-input"]', 'Enter');
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();

    // 3. 상품 상세 페이지
    await page.click('[data-testid="product-card"]', { position: { x: 50, y: 50 } });
    await expect(page).toHaveURL(/\/products\/\w+/);
    await expect(page.locator('h1')).toContainText('무선 이어폰');

    // 4. 장바구니 추가
    await page.click('button:has-text("장바구니 담기")');
    await expect(page.locator('.toast')).toContainText('장바구니에 추가되었습니다');

    // 5. 장바구니 확인
    await page.click('[data-testid="cart-icon"]');
    await expect(page).toHaveURL('/cart');
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // 6. 결제하기
    await page.click('button:has-text("결제하기")');
    await expect(page).toHaveURL('/checkout');

    // 7. 배송지 입력
    await page.fill('[name="shipping.name"]', '홍길동');
    await page.fill('[name="shipping.phone"]', '010-1234-5678');
    await page.fill('[name="shipping.address"]', '서울시 강남구 테헤란로 123');
    await page.click('button:has-text("다음")');

    // 8. 결제 수단 선택
    await page.click('[data-testid="payment-method-card"]');
    await page.fill('[name="cardNumber"]', '1234-5678-9012-3456');
    await page.fill('[name="expiry"]', '12/26');
    await page.fill('[name="cvc"]', '123');

    // 9. 주문 완료
    await page.click('button:has-text("결제하기")');

    // 10. 주문 완료 확인
    await expect(page).toHaveURL(/\/orders\/\w+\/complete/);
    await expect(page.locator('h1')).toContainText('주문이 완료되었습니다');
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
  });

  test('should show error for insufficient stock', async ({ page }) => {
    await page.goto('/products/out-of-stock-product');
    await page.click('button:has-text("장바구니 담기")');

    await expect(page.locator('.error-message')).toContainText('재고가 부족합니다');
  });
});
```

#### 2. Visual Regression Test
```typescript
// e2e/visual/product-page.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Product Page Visual Tests', () => {
  test('should match product page screenshot', async ({ page }) => {
    await page.goto('/products/sample-product-123');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('product-page.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should match mobile product page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/products/sample-product-123');

    await expect(page).toHaveScreenshot('product-page-mobile.png');
  });
});
```

## Performance Tests

### 도구
- **Load Testing**: Artillery, k6
- **Profiling**: Node.js --inspect, Chrome DevTools

### 예시

#### 1. API Load Test (k6)
```javascript
// tests/performance/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  // Product List
  let response = http.get('https://api.example.com/products?page=1&size=20');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Product Detail
  const productId = 'prod-123';
  response = http.get(`https://api.example.com/products/${productId}`);
  check(response, {
    'product detail loaded': (r) => r.json('data.id') === productId,
  });

  sleep(2);
}
```

#### 2. Database Query Performance
```typescript
// tests/performance/database-benchmark.test.ts
import { performance } from 'perf_hooks';
import { ProductRepository } from '@/repositories/ProductRepository';

describe('Database Performance', () => {
  it('should load 1000 products in < 100ms', async () => {
    const repo = new ProductRepository();

    const start = performance.now();
    const products = await repo.findMany({ limit: 1000 });
    const duration = performance.now() - start;

    expect(products).toHaveLength(1000);
    expect(duration).toBeLessThan(100);
  });

  it('should handle N+1 with DataLoader', async () => {
    const repo = new ProductRepository();

    const start = performance.now();
    const products = await repo.findMany({ limit: 100 });
    await Promise.all(products.map(p => p.getSeller())); // N+1 potential
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // DataLoader should batch
  });
});
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

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

## Test Metrics

### 현재 상태

| 지표 | 목표 | 현재 | 상태 |
|------|------|------|------|
| Unit Test Coverage | 80% | 85% | ✅ |
| Integration Test Coverage | 70% | 68% | ⚠️ |
| E2E Test Coverage | 5 Critical Paths | 4 | ⚠️ |
| Test Execution Time | < 10min | 8min | ✅ |
| Flaky Test Rate | < 1% | 0.5% | ✅ |

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-02-19
**작성자**: QA Team
