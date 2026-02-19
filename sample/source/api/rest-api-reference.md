# REST API Reference

## Base URL
```
Production: https://api.example.com
Staging: https://api-staging.example.com
Development: http://localhost:3000
```

## Authentication

### Bearer Token
```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### API Key (Public API)
```http
X-API-Key: YOUR_API_KEY
```

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2026-02-19T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The 'email' field is required",
    "details": {
      "field": "email",
      "reason": "missing"
    }
  },
  "meta": {
    "timestamp": "2026-02-19T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - 요청 성공 |
| 201 | Created - 리소스 생성 성공 |
| 204 | No Content - 성공, 응답 본문 없음 |
| 400 | Bad Request - 잘못된 요청 |
| 401 | Unauthorized - 인증 실패 |
| 403 | Forbidden - 권한 없음 |
| 404 | Not Found - 리소스 없음 |
| 409 | Conflict - 충돌 (중복 생성 등) |
| 422 | Unprocessable Entity - 유효성 검증 실패 |
| 429 | Too Many Requests - Rate Limit 초과 |
| 500 | Internal Server Error - 서버 오류 |
| 503 | Service Unavailable - 서비스 일시 중단 |

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_PARAMETER | 400 | 요청 파라미터 오류 |
| UNAUTHORIZED | 401 | 인증 실패 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| ALREADY_EXISTS | 409 | 이미 존재하는 리소스 |
| VALIDATION_ERROR | 422 | 유효성 검증 실패 |
| RATE_LIMIT_EXCEEDED | 429 | Rate Limit 초과 |
| INTERNAL_ERROR | 500 | 서버 내부 오류 |
| SERVICE_UNAVAILABLE | 503 | 서비스 이용 불가 |

---

# Endpoints

## Authentication

### POST /api/auth/register
회원가입

**Request**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "agreements": {
    "terms": true,
    "privacy": true,
    "marketing": false
  }
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "userId": "usr_1a2b3c4d",
    "email": "user@example.com",
    "name": "홍길동",
    "emailVerificationRequired": true
  }
}
```

**Errors**
- `EMAIL_ALREADY_EXISTS` (409): 이미 가입된 이메일
- `WEAK_PASSWORD` (422): 비밀번호 강도 부족
- `INVALID_EMAIL` (422): 잘못된 이메일 형식

---

### POST /api/auth/login
로그인

**Request**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "usr_1a2b3c4d",
      "email": "user@example.com",
      "name": "홍길동",
      "role": "customer"
    }
  }
}
```

**Errors**
- `INVALID_CREDENTIALS` (401): 이메일 또는 비밀번호 불일치
- `EMAIL_NOT_VERIFIED` (403): 이메일 미인증
- `ACCOUNT_SUSPENDED` (403): 계정 정지

---

### POST /api/auth/refresh
Access Token 갱신

**Request**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

---

## Products

### GET /api/products
상품 목록 조회

**Query Parameters**
```
page: 페이지 번호 (default: 1)
size: 페이지 크기 (default: 20, max: 100)
category: 카테고리 ID
brand: 브랜드 ID (comma-separated)
price_min: 최소 가격
price_max: 최대 가격
sort: 정렬 (relevance, price_asc, price_desc, popular, newest)
search: 검색 키워드
```

**Example Request**
```bash
GET /api/products?category=electronics&price_max=500000&sort=popular&page=1&size=20
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_12345",
        "name": "Apple AirPods Pro 2세대",
        "slug": "apple-airpods-pro-2",
        "price": 359000,
        "originalPrice": 389000,
        "discountRate": 8,
        "thumbnail": "https://cdn.example.com/products/airpods.jpg",
        "rating": 4.8,
        "reviewCount": 2341,
        "brand": {
          "id": "brand_apple",
          "name": "Apple"
        },
        "category": {
          "id": "cat_electronics",
          "name": "전자기기"
        },
        "badges": ["베스트", "무료배송"],
        "stock": 150,
        "isAvailable": true
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 1523,
      "totalPages": 77
    },
    "filters": {
      "categories": [
        { "id": "cat_electronics", "name": "전자기기", "count": 452 }
      ],
      "brands": [
        { "id": "brand_apple", "name": "Apple", "count": 45 },
        { "id": "brand_samsung", "name": "Samsung", "count": 67 }
      ],
      "priceRanges": [
        { "min": 0, "max": 50000, "count": 152 },
        { "min": 50000, "max": 100000, "count": 89 }
      ]
    }
  }
}
```

**Cache Headers**
```
Cache-Control: public, max-age=300
ETag: "abc123def456"
```

---

### GET /api/products/:id
상품 상세 조회

**Path Parameters**
```
id: 상품 ID (required)
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "prod_12345",
    "name": "Apple AirPods Pro 2세대",
    "slug": "apple-airpods-pro-2",
    "description": "액티브 노이즈 캔슬링과 적응형 투명 모드를 갖춘...",
    "price": 359000,
    "originalPrice": 389000,
    "stock": 150,
    "sku": "AIRPODS-PRO-2-WHITE",

    "images": [
      {
        "url": "https://cdn.example.com/products/airpods-1.jpg",
        "alt": "AirPods Pro 정면",
        "order": 1
      },
      {
        "url": "https://cdn.example.com/products/airpods-2.jpg",
        "alt": "AirPods Pro 측면",
        "order": 2
      }
    ],

    "variants": [
      {
        "id": "var_123",
        "name": "화이트",
        "options": { "color": "white" },
        "price": 359000,
        "stock": 150,
        "sku": "AIRPODS-PRO-2-WHITE"
      }
    ],

    "specs": {
      "무게": "5.3g (이어폰 하나)",
      "배터리": "최대 6시간",
      "충전": "MagSafe, Lightning",
      "방수": "IPX4"
    },

    "seller": {
      "id": "seller_apple",
      "name": "Apple 공식 스토어",
      "rating": 4.9,
      "responseRate": 99
    },

    "shipping": {
      "freeShipping": true,
      "estimatedDays": 1,
      "methods": ["standard", "express"]
    },

    "reviews": {
      "average": 4.8,
      "count": 2341,
      "distribution": {
        "5": 1856,
        "4": 389,
        "3": 72,
        "2": 18,
        "1": 6
      }
    },

    "relatedProducts": [
      {
        "id": "prod_67890",
        "name": "AirPods 3세대",
        "price": 259000,
        "thumbnail": "https://cdn.example.com/products/airpods3.jpg"
      }
    ]
  }
}
```

**Errors**
- `NOT_FOUND` (404): 상품 없음

---

### POST /api/products
상품 등록 (판매자 전용)

**Authentication Required**: Bearer Token (role: seller)

**Request**
```json
{
  "name": "무선 키보드 K380",
  "description": "멀티 디바이스 무선 키보드...",
  "price": 49000,
  "originalPrice": 59000,
  "categoryId": "cat_electronics",
  "brandId": "brand_logitech",
  "stock": 100,
  "sku": "K380-BLACK",

  "images": [
    "https://cdn.example.com/upload/keyboard-1.jpg",
    "https://cdn.example.com/upload/keyboard-2.jpg"
  ],

  "variants": [
    {
      "name": "블랙",
      "options": { "color": "black" },
      "stock": 50
    },
    {
      "name": "화이트",
      "options": { "color": "white" },
      "stock": 50
    }
  ],

  "specs": {
    "연결": "Bluetooth",
    "배터리": "AAA x2",
    "호환": "Windows, Mac, iOS, Android"
  },

  "shipping": {
    "weight": 423,
    "dimensions": {
      "width": 279,
      "height": 124,
      "depth": 16
    }
  }
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "prod_new123",
    "name": "무선 키보드 K380",
    "status": "draft",
    "createdAt": "2026-02-19T10:30:00Z"
  }
}
```

**Errors**
- `UNAUTHORIZED` (401): 인증 실패
- `FORBIDDEN` (403): 판매자 권한 없음
- `VALIDATION_ERROR` (422): 필수 필드 누락 or 유효성 검증 실패

---

## Cart

### GET /api/cart
장바구니 조회

**Authentication**: Optional (로그인하지 않으면 session 기반)

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "cart_abc123",
    "items": [
      {
        "id": "item_1",
        "product": {
          "id": "prod_12345",
          "name": "Apple AirPods Pro",
          "thumbnail": "https://cdn.example.com/products/airpods.jpg",
          "price": 359000
        },
        "variant": {
          "id": "var_123",
          "name": "화이트"
        },
        "quantity": 1,
        "price": 359000,
        "subtotal": 359000,
        "isAvailable": true
      },
      {
        "id": "item_2",
        "product": {
          "id": "prod_67890",
          "name": "무선 키보드",
          "thumbnail": "https://cdn.example.com/products/keyboard.jpg",
          "price": 49000
        },
        "variant": null,
        "quantity": 2,
        "price": 49000,
        "subtotal": 98000,
        "isAvailable": true
      }
    ],
    "summary": {
      "itemCount": 2,
      "subtotal": 457000,
      "shippingFee": 3000,
      "discount": 0,
      "total": 460000,
      "freeShippingThreshold": 500000,
      "freeShippingProgress": 0.914
    },
    "availableCoupons": [
      {
        "id": "coupon_10",
        "name": "첫 구매 10% 할인",
        "type": "percentage",
        "value": 10,
        "discount": 45700,
        "minPurchase": 0,
        "expiresAt": "2026-03-01T00:00:00Z"
      }
    ],
    "recommendations": [
      {
        "id": "prod_111",
        "name": "마우스 패드",
        "price": 15000,
        "thumbnail": "https://cdn.example.com/products/mousepad.jpg",
        "reason": "자주 함께 구매됨"
      }
    ]
  }
}
```

---

### POST /api/cart/items
장바구니에 상품 추가

**Request**
```json
{
  "productId": "prod_12345",
  "variantId": "var_123",
  "quantity": 1
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "itemId": "item_1",
    "cartItemCount": 3
  },
  "message": "장바구니에 추가되었습니다"
}
```

**Errors**
- `OUT_OF_STOCK` (409): 재고 부족
- `INVALID_QUANTITY` (422): 수량 오류 (< 1)

---

### PATCH /api/cart/items/:itemId
장바구니 상품 수량 변경

**Request**
```json
{
  "quantity": 2
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "item_1",
      "quantity": 2,
      "subtotal": 718000
    },
    "cart": {
      "subtotal": 914000,
      "total": 917000
    }
  }
}
```

---

### DELETE /api/cart/items/:itemId
장바구니 상품 삭제

**Response** `204 No Content`

---

## Orders

### POST /api/orders
주문 생성

**Authentication Required**

**Request**
```json
{
  "items": [
    {
      "productId": "prod_12345",
      "variantId": "var_123",
      "quantity": 1,
      "price": 359000
    }
  ],
  "shippingAddress": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "zipCode": "06234",
    "address": "서울시 강남구 테헤란로 123",
    "addressDetail": "4층"
  },
  "deliveryRequest": "문 앞에 놓아주세요",
  "couponId": "coupon_10",
  "paymentMethod": "card"
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "orderId": "ord_abc123",
    "orderNumber": "20260219-0342",
    "status": "payment_pending",
    "total": 323100,
    "paymentUrl": "https://pay.tosspayments.com/abc123",
    "expiresAt": "2026-02-19T11:00:00Z"
  }
}
```

**Errors**
- `OUT_OF_STOCK` (409): 재고 부족
- `INVALID_ADDRESS` (422): 주소 오류
- `COUPON_EXPIRED` (422): 쿠폰 만료

---

### GET /api/orders/:id
주문 상세 조회

**Authentication Required**

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "ord_abc123",
    "orderNumber": "20260219-0342",
    "status": "delivered",
    "createdAt": "2026-02-19T10:30:00Z",
    "paidAt": "2026-02-19T10:31:15Z",
    "shippedAt": "2026-02-19T14:00:00Z",
    "deliveredAt": "2026-02-20T09:30:00Z",

    "items": [
      {
        "id": "item_1",
        "productName": "Apple AirPods Pro",
        "variantName": "화이트",
        "quantity": 1,
        "price": 359000,
        "subtotal": 359000,
        "thumbnail": "https://cdn.example.com/products/airpods.jpg"
      }
    ],

    "pricing": {
      "subtotal": 359000,
      "shippingFee": 0,
      "discount": 35900,
      "total": 323100
    },

    "shippingAddress": {
      "name": "홍길동",
      "phone": "010-1234-5678",
      "zipCode": "06234",
      "address": "서울시 강남구 테헤란로 123",
      "addressDetail": "4층"
    },

    "payment": {
      "method": "card",
      "cardInfo": {
        "company": "신한카드",
        "number": "1234-****-****-5678",
        "installment": 0
      },
      "paidAmount": 323100,
      "paidAt": "2026-02-19T10:31:15Z"
    },

    "tracking": {
      "carrier": "CJ대한통운",
      "trackingNumber": "123456789012",
      "status": "delivered",
      "events": [
        {
          "status": "delivered",
          "location": "서울 강남구",
          "timestamp": "2026-02-20T09:30:00Z"
        },
        {
          "status": "out_for_delivery",
          "location": "서울 강남구 집하장",
          "timestamp": "2026-02-20T07:00:00Z"
        }
      ]
    }
  }
}
```

---

### GET /api/orders
주문 목록 조회

**Authentication Required**

**Query Parameters**
```
page: 페이지 (default: 1)
size: 크기 (default: 20)
status: 주문 상태 (paid, shipped, delivered, cancelled)
startDate: 시작 날짜 (YYYY-MM-DD)
endDate: 종료 날짜 (YYYY-MM-DD)
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_abc123",
        "orderNumber": "20260219-0342",
        "status": "delivered",
        "createdAt": "2026-02-19T10:30:00Z",
        "total": 323100,
        "itemCount": 1,
        "thumbnail": "https://cdn.example.com/products/airpods.jpg"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## Rate Limiting

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1645257600
```

**Limits**
- **Public API**: 100 req/min
- **Authenticated**: 1000 req/min
- **Search API**: 60 req/min

**Response** `429 Too Many Requests`
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## Pagination

모든 리스트 API는 다음 형식의 페이지네이션을 지원:

```json
{
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 1523,
    "totalPages": 77,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Link Header** (선택적)
```
Link: <https://api.example.com/products?page=2>; rel="next",
      <https://api.example.com/products?page=77>; rel="last"
```

---

## Webhooks

특정 이벤트 발생 시 등록된 URL로 POST 요청 전송

### Events
- `order.created`: 주문 생성
- `order.paid`: 결제 완료
- `order.shipped`: 배송 시작
- `order.delivered`: 배송 완료
- `order.cancelled`: 주문 취소

### Webhook Payload
```json
{
  "event": "order.paid",
  "timestamp": "2026-02-19T10:31:15Z",
  "data": {
    "orderId": "ord_abc123",
    "orderNumber": "20260219-0342",
    "amount": 323100,
    "userId": "usr_xyz789"
  }
}
```

### Webhook Signature
```
X-Webhook-Signature: sha256=abc123def456...
```

검증 방법:
```javascript
const crypto = require('crypto');

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature !== receivedSignature) {
  throw new Error('Invalid signature');
}
```

---

**API Version**: v1
**Last Updated**: 2026-02-19
**Contact**: api-support@example.com
