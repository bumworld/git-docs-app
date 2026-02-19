# System Architecture

## High-Level Architecture

```mermaid
C4Context
    title System Context Diagram - E-Commerce Platform

    Person(customer, "고객", "온라인 쇼핑 사용자")
    Person(seller, "판매자", "상품 판매자")
    Person(admin, "관리자", "시스템 운영자")

    System(ecommerce, "E-Commerce Platform", "온라인 쇼핑몰 시스템")

    System_Ext(pg, "Payment Gateway", "결제 대행사 (토스페이먼츠)")
    System_Ext(shipping, "배송 API", "택배사 연동")
    System_Ext(sms, "SMS Gateway", "알림톡 발송")
    System_Ext(email, "Email Service", "이메일 발송 (SendGrid)")
    System_Ext(cdn, "CDN", "이미지/정적 파일 제공 (CloudFront)")

    Rel(customer, ecommerce, "상품 검색, 주문", "HTTPS")
    Rel(seller, ecommerce, "상품 등록, 주문 관리", "HTTPS")
    Rel(admin, ecommerce, "시스템 관리", "HTTPS")

    Rel(ecommerce, pg, "결제 요청/검증", "HTTPS/REST")
    Rel(ecommerce, shipping, "배송 조회", "HTTPS/REST")
    Rel(ecommerce, sms, "알림 발송", "HTTPS/REST")
    Rel(ecommerce, email, "이메일 발송", "HTTPS/REST")
    Rel(ecommerce, cdn, "이미지 제공", "HTTPS")

    UpdateRelStyle(customer, ecommerce, $offsetY="-40", $offsetX="-60")
    UpdateRelStyle(ecommerce, pg, $offsetY="-20")
```

## Container Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App<br/>React + Next.js]
        MOBILE[Mobile App<br/>React Native]
        ADMIN[Admin Dashboard<br/>React + Ant Design]
    end

    subgraph "API Gateway Layer"
        NGINX[NGINX<br/>Load Balancer + SSL]
        KONG[Kong API Gateway<br/>Rate Limiting, Auth]
    end

    subgraph "Application Layer"
        API1[API Server 1<br/>Node.js + Express]
        API2[API Server 2<br/>Node.js + Express]
        API3[API Server 3<br/>Node.js + Express]

        BFF_WEB[BFF Web<br/>GraphQL]
        BFF_MOBILE[BFF Mobile<br/>GraphQL]
    end

    subgraph "Service Layer"
        AUTH[Auth Service<br/>JWT, OAuth]
        PRODUCT[Product Service<br/>Catalog, Search]
        ORDER[Order Service<br/>Cart, Checkout]
        PAYMENT[Payment Service<br/>PG Integration]
        NOTIFICATION[Notification Service<br/>Email, SMS, Push]
        ANALYTICS[Analytics Service<br/>Event Tracking]
    end

    subgraph "Background Jobs"
        QUEUE[Message Queue<br/>RabbitMQ]
        WORKER1[Worker 1<br/>Order Processing]
        WORKER2[Worker 2<br/>Email Sending]
        WORKER3[Worker 3<br/>Data Sync]
    end

    subgraph "Data Layer"
        MYSQL[(MySQL<br/>Primary + Replicas)]
        REDIS[(Redis<br/>Cache + Session)]
        ES[(Elasticsearch<br/>Search Engine)]
        S3[(S3<br/>File Storage)]
    end

    WEB --> NGINX
    MOBILE --> NGINX
    ADMIN --> NGINX

    NGINX --> KONG
    KONG --> API1
    KONG --> API2
    KONG --> API3
    KONG --> BFF_WEB
    KONG --> BFF_MOBILE

    API1 --> AUTH
    API1 --> PRODUCT
    API1 --> ORDER
    API2 --> AUTH
    API2 --> PRODUCT
    API2 --> ORDER
    API3 --> PAYMENT
    API3 --> NOTIFICATION

    BFF_WEB --> API1
    BFF_MOBILE --> API2

    AUTH --> MYSQL
    AUTH --> REDIS
    PRODUCT --> MYSQL
    PRODUCT --> ES
    ORDER --> MYSQL
    ORDER --> QUEUE
    PAYMENT --> MYSQL

    QUEUE --> WORKER1
    QUEUE --> WORKER2
    QUEUE --> WORKER3

    WORKER1 --> MYSQL
    WORKER2 --> NOTIFICATION
    WORKER3 --> ES

    PRODUCT --> S3
    NOTIFICATION --> S3

    style WEB fill:#4A90E2
    style MOBILE fill:#4A90E2
    style ADMIN fill:#4A90E2
    style MYSQL fill:#E85D75
    style REDIS fill:#DC382C
    style ES fill:#00BFB3
    style QUEUE fill:#FF6F00
```

## Microservices Architecture (Phase 2 목표)

### Service Decomposition

```mermaid
graph LR
    subgraph "User Domain"
        US[User Service]
        AS[Auth Service]
    end

    subgraph "Product Domain"
        PS[Product Service]
        CS[Category Service]
        RS[Review Service]
    end

    subgraph "Order Domain"
        OS[Order Service]
        CAS[Cart Service]
        PAS[Payment Service]
    end

    subgraph "Fulfillment Domain"
        IS[Inventory Service]
        SS[Shipping Service]
    end

    subgraph "Platform Services"
        NS[Notification Service]
        ANS[Analytics Service]
        SES[Search Service]
    end

    US -.->|이벤트| OS
    PS -.->|이벤트| SES
    OS -.->|이벤트| IS
    OS -.->|이벤트| NS
    PAS -.->|이벤트| OS

    style US fill:#FFE5E5
    style PS fill:#E5F5FF
    style OS fill:#FFF5E5
    style IS fill:#E5FFE5
    style NS fill:#F5E5FF
```

### 서비스 간 통신

#### Synchronous (REST/gRPC)
```
Order Service --> Payment Service (결제 요청)
Order Service --> Inventory Service (재고 확인)
Product Service --> Review Service (리뷰 조회)
```

#### Asynchronous (Message Queue)
```
Order Placed Event --> Notification Service (주문 확인 이메일)
Order Placed Event --> Analytics Service (이벤트 트래킹)
Payment Completed Event --> Order Service (주문 상태 업데이트)
```

## Data Flow Architecture

### 주문 플로우 (Order Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant WebApp
    participant API Gateway
    participant Order Service
    participant Inventory Service
    participant Payment Service
    participant MySQL
    participant Redis
    participant MQ as Message Queue
    participant Notification

    User->>WebApp: 결제하기 클릭
    WebApp->>API Gateway: POST /orders/checkout
    API Gateway->>Order Service: Create Order

    Order Service->>Inventory Service: Reserve Stock
    alt Stock Available
        Inventory Service-->>Order Service: Stock Reserved
        Order Service->>MySQL: Insert Order (status: pending)
        Order Service->>Redis: Cache Order

        Order Service->>Payment Service: Process Payment
        Payment Service->>Payment Service: Call PG API

        alt Payment Success
            Payment Service-->>Order Service: Payment Success
            Order Service->>MySQL: Update Order (status: paid)
            Order Service->>MQ: Publish OrderPaidEvent

            MQ->>Notification: OrderPaidEvent
            Notification->>User: 주문 확인 이메일

            Order Service-->>API Gateway: Order Success
            API Gateway-->>WebApp: 200 OK
            WebApp-->>User: 주문 완료 화면
        else Payment Failed
            Payment Service-->>Order Service: Payment Failed
            Order Service->>Inventory Service: Release Stock
            Order Service->>MySQL: Update Order (status: failed)
            Order Service-->>API Gateway: Payment Failed
            API Gateway-->>WebApp: 402 Payment Required
            WebApp-->>User: 결제 실패 메시지
        end
    else Stock Unavailable
        Inventory Service-->>Order Service: Stock Unavailable
        Order Service-->>API Gateway: 409 Conflict
        API Gateway-->>WebApp: Stock Error
        WebApp-->>User: 재고 부족 메시지
    end
```

### 상품 검색 플로우

```mermaid
sequenceDiagram
    actor User
    participant WebApp
    participant CDN
    participant API
    participant Redis
    participant Elasticsearch
    participant MySQL

    User->>WebApp: 검색어 입력
    WebApp->>CDN: 자동완성 요청
    CDN->>API: GET /search/autocomplete?q=아이폰

    API->>Redis: Check Cache
    alt Cache Hit
        Redis-->>API: Cached Results
        API-->>CDN: Return Results (50ms)
    else Cache Miss
        Redis-->>API: Cache Miss
        API->>Elasticsearch: Search Query
        Elasticsearch-->>API: Search Results (100ms)
        API->>Redis: Store Cache (TTL: 5min)
        API-->>CDN: Return Results (150ms)
    end

    CDN-->>WebApp: Autocomplete List
    WebApp-->>User: 실시간 제안

    User->>WebApp: 검색 실행
    WebApp->>API: GET /search?q=아이폰

    API->>Redis: Check Cache
    alt Cache Hit
        Redis-->>API: Cached Products
    else Cache Miss
        API->>Elasticsearch: Full Search
        Elasticsearch->>MySQL: Fetch Product Details
        MySQL-->>Elasticsearch: Product Data
        Elasticsearch-->>API: Ranked Results
        API->>Redis: Cache Results
    end

    API-->>WebApp: Product List
    WebApp-->>User: 검색 결과 표시
```

## Infrastructure Architecture

### AWS Architecture

```mermaid
graph TB
    subgraph "Edge Layer"
        CF[CloudFront CDN]
        R53[Route 53<br/>DNS]
    end

    subgraph "Load Balancing"
        ALB[Application Load Balancer]
    end

    subgraph "Availability Zone 1"
        subgraph "Public Subnet 1a"
            NAT1[NAT Gateway]
        end
        subgraph "Private Subnet 1a"
            EC2_1A_1[EC2: API Server]
            EC2_1A_2[EC2: API Server]
        end
    end

    subgraph "Availability Zone 2"
        subgraph "Public Subnet 1b"
            NAT2[NAT Gateway]
        end
        subgraph "Private Subnet 1b"
            EC2_1B_1[EC2: API Server]
            EC2_1B_2[EC2: API Server]
        end
    end

    subgraph "Data Layer"
        RDS_MASTER[(RDS MySQL<br/>Primary)]
        RDS_REPLICA[(RDS MySQL<br/>Read Replica)]
        ELASTICACHE[(ElastiCache<br/>Redis Cluster)]
        ES_CLUSTER[(Elasticsearch<br/>Service)]
    end

    subgraph "Storage"
        S3_ASSETS[S3: Assets]
        S3_BACKUP[S3: Backups]
    end

    subgraph "Monitoring"
        CW[CloudWatch]
        XR[X-Ray]
    end

    R53 --> CF
    CF --> ALB
    ALB --> EC2_1A_1
    ALB --> EC2_1A_2
    ALB --> EC2_1B_1
    ALB --> EC2_1B_2

    EC2_1A_1 --> RDS_MASTER
    EC2_1A_2 --> RDS_REPLICA
    EC2_1B_1 --> RDS_MASTER
    EC2_1B_2 --> RDS_REPLICA

    EC2_1A_1 --> ELASTICACHE
    EC2_1A_2 --> ELASTICACHE
    EC2_1B_1 --> ELASTICACHE
    EC2_1B_2 --> ELASTICACHE

    EC2_1A_1 --> ES_CLUSTER
    EC2_1B_1 --> ES_CLUSTER

    CF --> S3_ASSETS
    RDS_MASTER -.->|Backup| S3_BACKUP

    EC2_1A_1 --> CW
    EC2_1A_2 --> CW
    EC2_1B_1 --> CW
    EC2_1B_2 --> CW

    EC2_1A_1 --> XR
    EC2_1B_1 --> XR

    style CF fill:#FF9900
    style R53 fill:#FF9900
    style ALB fill:#FF9900
    style RDS_MASTER fill:#527FFF
    style ELASTICACHE fill:#D32F2F
    style ES_CLUSTER fill:#00BFB3
```

### Kubernetes Architecture (Phase 2)

```yaml
# 마이크로서비스 배포 구조
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce-production

---
# API Server Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: ecommerce-production
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v1.2.3
    spec:
      containers:
      - name: api
        image: ecommerce/api-server:1.2.3
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: ecommerce-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Security Architecture

### 보안 계층

```mermaid
graph TB
    subgraph "Edge Security"
        WAF[AWS WAF<br/>SQL Injection, XSS 차단]
        SHIELD[AWS Shield<br/>DDoS 방어]
    end

    subgraph "Network Security"
        SG[Security Groups<br/>방화벽 규칙]
        NACL[Network ACL<br/>서브넷 레벨 제어]
        VPN[VPN Gateway<br/>관리자 접근]
    end

    subgraph "Application Security"
        OAUTH[OAuth 2.0<br/>인증]
        JWT[JWT Token<br/>세션 관리]
        RBAC[RBAC<br/>권한 제어]
        ENCRYPTION[Encryption at Rest<br/>데이터 암호화]
    end

    subgraph "Data Security"
        KMS[AWS KMS<br/>키 관리]
        SECRETS[Secrets Manager<br/>자격증명 관리]
        AUDIT[CloudTrail<br/>감사 로그]
    end

    WAF --> SG
    SHIELD --> SG
    SG --> OAUTH
    NACL --> JWT
    VPN --> RBAC

    OAUTH --> KMS
    JWT --> SECRETS
    ENCRYPTION --> KMS
    RBAC --> AUDIT

    style WAF fill:#FF6B6B
    style SHIELD fill:#FF6B6B
    style OAUTH fill:#4ECDC4
    style JWT fill:#4ECDC4
    style KMS fill:#FFE66D
    style AUDIT fill:#95E1D3
```

### 인증/인가 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant GW as API Gateway
    participant AUTH as Auth Service
    participant API as API Service
    participant DB as Database

    U->>FE: 로그인 (email, password)
    FE->>GW: POST /auth/login
    GW->>AUTH: Authenticate

    AUTH->>DB: Verify Credentials
    DB-->>AUTH: User Found

    AUTH->>AUTH: Generate JWT
    Note over AUTH: payload: {userId, role, exp}

    AUTH->>AUTH: Generate Refresh Token
    AUTH->>DB: Store Refresh Token
    AUTH-->>GW: {accessToken, refreshToken}
    GW-->>FE: Set HttpOnly Cookie
    FE-->>U: Redirect to Home

    Note over U,API: Authenticated Request

    U->>FE: API 요청
    FE->>GW: GET /api/orders (with Cookie)
    GW->>GW: Extract & Verify JWT

    alt Token Valid
        GW->>API: Forward Request (with user context)
        API->>API: Check Authorization (RBAC)
        alt Authorized
            API->>DB: Fetch Data
            DB-->>API: Data
            API-->>GW: Response
            GW-->>FE: Response
            FE-->>U: Display Data
        else Unauthorized
            API-->>GW: 403 Forbidden
            GW-->>FE: 403 Forbidden
            FE-->>U: Error Message
        end
    else Token Expired
        GW-->>FE: 401 Unauthorized
        FE->>GW: POST /auth/refresh (with refresh token)
        GW->>AUTH: Refresh Token
        AUTH->>DB: Verify Refresh Token
        alt Valid Refresh Token
            AUTH->>AUTH: Generate New Access Token
            AUTH-->>GW: New Access Token
            GW-->>FE: Set New Cookie
            FE->>GW: Retry Original Request
        else Invalid Refresh Token
            AUTH-->>GW: 401 Unauthorized
            GW-->>FE: 401 Unauthorized
            FE-->>U: Redirect to Login
        end
    end
```

## Performance & Scalability

### 캐싱 전략

```mermaid
graph LR
    A[Request] --> B{CDN Cache?}
    B -->|Hit| C[Return from CDN]
    B -->|Miss| D{Redis Cache?}
    D -->|Hit| E[Return from Redis]
    D -->|Miss| F{App Cache?}
    F -->|Hit| G[Return from Memory]
    F -->|Miss| H[Query Database]
    H --> I[Update All Caches]
    I --> J[Return Response]

    style C fill:#90EE90
    style E fill:#FFD700
    style G fill:#87CEEB
    style H fill:#FFB6C1
```

#### 캐시 레이어별 전략

| 레이어 | 대상 | TTL | 무효화 전략 |
|--------|------|-----|-------------|
| CDN | 정적 파일, 이미지 | 1년 | 파일명 해시 |
| Redis | API 응답, 세션 | 5-60분 | 데이터 변경 시 |
| Application | 설정, 메타데이터 | 10분 | 재시작 시 |

### 확장성 패턴

#### Horizontal Scaling
```
현재: 3 API Servers
트래픽 증가 시: Auto Scaling → 20 Servers
```

#### Database Scaling
```
Read: Primary + 2 Read Replicas
Write: Primary Only
Future: Sharding (user_id 기준)
```

#### Message Queue
```
비동기 처리: RabbitMQ
- 이메일 발송
- 데이터 동기화
- 이미지 리사이징
```

## Monitoring & Observability

### Metrics

```mermaid
graph TB
    subgraph "Infrastructure Metrics"
        IM1[CPU Usage]
        IM2[Memory Usage]
        IM3[Disk I/O]
        IM4[Network Traffic]
    end

    subgraph "Application Metrics"
        AM1[Request Rate]
        AM2[Response Time P95]
        AM3[Error Rate]
        AM4[Active Users]
    end

    subgraph "Business Metrics"
        BM1[Orders per Minute]
        BM2[Revenue per Hour]
        BM3[Conversion Rate]
        BM4[Cart Abandonment]
    end

    subgraph "Monitoring Tools"
        CW[CloudWatch]
        DD[DataDog]
        GRAFANA[Grafana]
    end

    IM1 --> CW
    IM2 --> CW
    IM3 --> CW
    IM4 --> CW

    AM1 --> DD
    AM2 --> DD
    AM3 --> DD
    AM4 --> DD

    BM1 --> GRAFANA
    BM2 --> GRAFANA
    BM3 --> GRAFANA
    BM4 --> GRAFANA

    CW --> GRAFANA
    DD --> GRAFANA
```

### Distributed Tracing

```javascript
// X-Ray를 통한 요청 추적
const AWSXRay = require('aws-xray-sdk-core');
const http = AWSXRay.captureHTTPs(require('http'));

app.get('/api/orders/:id', async (req, res) => {
  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment('fetch-order');

  try {
    // Database Query (traced)
    subsegment.addAnnotation('orderId', req.params.id);
    const order = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);

    // External API Call (traced)
    const shipping = await axios.get(`https://shipping-api/track/${order.trackingNumber}`);

    res.json({ order, shipping });
  } catch (error) {
    subsegment.addError(error);
    throw error;
  } finally {
    subsegment.close();
  }
});
```

## Disaster Recovery

### 백업 전략
- **Database**: Daily full backup + hourly incremental
- **Files**: S3 versioning + cross-region replication
- **Config**: Git repository + encrypted secrets

### RTO/RPO
- **RTO (Recovery Time Objective)**: 1시간
- **RPO (Recovery Point Objective)**: 5분

### Failover Plan
1. CloudWatch 알람 → PagerDuty
2. 자동 Failover (RDS Multi-AZ)
3. 수동 DR 사이트 활성화 (1시간 이내)

---

**문서 버전**: 2.0
**최종 업데이트**: 2026-02-19
**작성자**: Architecture Team
**검토자**: CTO, DevOps Lead
