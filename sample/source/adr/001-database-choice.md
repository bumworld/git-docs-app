# ADR 001: 데이터베이스 선택 - MySQL vs PostgreSQL

## Status
**Accepted** (2026-01-15)

## Context

이커머스 플랫폼 구축을 위한 Primary Database를 선택해야 함. 주요 고려사항:

### 요구사항
1. **트랜잭션 무결성**: 주문/결제 데이터는 ACID 보장 필수
2. **읽기 성능**: 상품 조회가 쓰기보다 10배 이상 많음
3. **확장성**: 향후 샤딩 지원 필요
4. **운영 경험**: 팀 내 MySQL 경험 많음
5. **비용**: AWS RDS 기준 비용 고려

### 비교 대상
- MySQL 8.0
- PostgreSQL 15

## Decision

**MySQL 8.0**을 Primary Database로 선택

## Rationale

### MySQL 선택 이유

#### 1. 읽기 성능 우수
```sql
-- Benchmark: 상품 목록 조회 (10,000회)
-- MySQL 8.0: 평균 15ms
-- PostgreSQL 15: 평균 23ms
```

MySQL의 InnoDB 엔진은 읽기 최적화에 강점:
- Adaptive Hash Index
- Change Buffering
- Read-Ahead 알고리즘

#### 2. 팀 역량
- 5명 중 4명이 MySQL 프로덕션 경험 보유
- PostgreSQL 경험자: 1명 (side project 수준)
- 온보딩 시간 단축 (2주 → 3일)

#### 3. Replication 간편성
```yaml
# MySQL Replication 설정
Primary:
  - Binlog 활성화
Replica:
  - CHANGE MASTER TO
  - START SLAVE
  → 10분 내 설정 완료
```

PostgreSQL의 WAL 기반 replication보다 직관적

#### 4. 비용
AWS RDS 기준 (db.r5.large, 1년 Reserved):
- MySQL: $1,050/월
- PostgreSQL: $1,230/월
→ MySQL이 15% 저렴

#### 5. 샤딩 에코시스템
- Vitess (YouTube가 개발, CNCF 프로젝트)
- ProxySQL
- 다양한 오픈소스 샤딩 솔루션

### PostgreSQL이 더 나은 점 (포기한 것)

#### 1. JSON 지원
PostgreSQL의 JSONB는 MySQL JSON보다 강력:
```sql
-- PostgreSQL
SELECT * FROM products
WHERE options @> '{"color": "red"}';  -- GIN index 사용

-- MySQL
SELECT * FROM products
WHERE JSON_CONTAINS(options, '{"color": "red"}');  -- Full scan
```

**대응**: JSON 컬럼 최소화, 필요 시 별도 컬럼으로 정규화

#### 2. 고급 기능
- Window Functions (더 풍부)
- CTEs (WITH RECURSIVE)
- Full Text Search (더 강력)

**대응**:
- Window Functions: MySQL 8.0에서 기본 지원
- Full Text Search: Elasticsearch로 대체

#### 3. 확장성 (Extensions)
PostgreSQL은 PostGIS, pg_trgm 등 다양한 확장 가능

**대응**: 필요한 기능은 Application Layer에서 구현

## Consequences

### Positive
- ✅ 빠른 개발 속도 (팀 역량 활용)
- ✅ 읽기 성능 우수 (상품 조회)
- ✅ 운영 부담 감소 (익숙한 도구)
- ✅ 비용 절감

### Negative
- ❌ JSON 쿼리 성능 제한 → 정규화로 우회
- ❌ 고급 SQL 기능 부족 → Application에서 처리
- ❌ GIS 기능 없음 → 별도 서비스 고려 (향후)

### Risks & Mitigation

#### Risk 1: JSON 쿼리 성능 이슈
**Mitigation**:
```sql
-- Bad: JSON 쿼리
SELECT * FROM products
WHERE JSON_EXTRACT(options, '$.color') = 'red';

-- Good: 정규화
CREATE TABLE product_variants (
  product_id VARCHAR(36),
  color VARCHAR(50),
  INDEX idx_color (color)
);
SELECT * FROM product_variants WHERE color = 'red';
```

#### Risk 2: Sharding 복잡도
**Mitigation**:
- Phase 1: Read Replica로 스케일 아웃 (1년)
- Phase 2: Vitess 도입 검토 (2년차)

## Alternatives Considered

### Alternative 1: PostgreSQL
**Pros**: JSON, Extensions, 고급 SQL
**Cons**: 팀 역량 부족, 높은 비용, 읽기 성능

→ 장기적으로는 PostgreSQL이 유리하나, 현 시점에서는 MySQL로 빠르게 시작

### Alternative 2: NoSQL (MongoDB)
**Pros**: 유연한 스키마, 수평 확장 쉬움
**Cons**: 트랜잭션 복잡, ACID 보장 약함, 이커머스에 부적합

→ 주문/결제 도메인은 RDBMS 필수

### Alternative 3: NewSQL (CockroachDB)
**Pros**: 수평 확장, ACID, PostgreSQL 호환
**Cons**: 러닝 커브, 운영 경험 부족, 고비용

→ 차기 아키텍처에서 검토

## Validation

### 성능 테스트 (Proof of Concept)
```bash
# 테스트 환경
- DB: MySQL 8.0.35 vs PostgreSQL 15.3
- Instance: db.r5.large (2 vCPU, 16 GB RAM)
- Dataset: 100만 상품, 1000만 주문

# 결과
1. 상품 목록 조회 (100 req/s, 10분)
   MySQL: P95 18ms, P99 35ms
   PostgreSQL: P95 25ms, P99 48ms
   → MySQL 승

2. 주문 생성 (트랜잭션)
   MySQL: P95 45ms, P99 78ms
   PostgreSQL: P95 43ms, P99 75ms
   → 비슷

3. 복잡한 집계 쿼리 (리포트)
   MySQL: 2.3초
   PostgreSQL: 1.8초
   → PostgreSQL 승
   → 대응: 리포트는 BigQuery로 오프로드
```

## References

- [MySQL 8.0 Documentation](https://dev.mysql.com/doc/refman/8.0/en/)
- [Vitess: Sharding for MySQL](https://vitess.io/)
- [Uber: Why We Switched from PostgreSQL to MySQL](https://eng.uber.com/postgres-to-mysql-migration/)
- [Shopify: MySQL at Scale](https://shopify.engineering/mysql-database-sharding)

## Review & Update

- **Review Date**: 2026-07-15 (6개월 후)
- **Criteria**:
  - 트래픽이 예상치(10,000 RPS) 초과 시 재검토
  - JSON 쿼리 성능 이슈 발생 시
  - 팀 PostgreSQL 역량 향상 시

---

**Author**: Database Team
**Reviewers**: CTO, Backend Lead, DevOps Lead
**Approved**: 2026-01-15
