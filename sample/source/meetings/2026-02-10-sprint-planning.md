# Sprint Planning Meeting - Sprint 12

**날짜**: 2026-02-10 (월) 14:00-16:00
**장소**: Zoom + 본사 3층 회의실
**참석자**:
- Product: 김민수 (PM), 이지은 (PO)
- Engineering: 박성호 (Tech Lead), 최현우, 정수진, 한지민
- Design: 강태양
- QA: 윤서연

**불참**: 없음

## Sprint 목표

> "장바구니 최적화를 통해 전환율을 28% → 32%로 개선한다"

## Sprint 기간
- **시작**: 2026-02-11 (화)
- **종료**: 2026-02-24 (월)
- **기간**: 2주 (10 working days)

## 지난 Sprint Review

### Sprint 11 성과
- ✅ 상품 검색 성능 개선 (200ms → 120ms)
- ✅ 모바일 UI 반응형 개선
- ✅ 결제 PG 추가 (카카오페이)
- ⚠️ 리뷰 시스템 (80% 완료, 이미지 업로드 미완)

### Velocity
- **Sprint 11**: 45 Story Points (목표 50)
- **평균 Velocity**: 48 SP
- **이번 Sprint 목표**: 50 SP

## Backlog 우선순위

### High Priority (Must Have)

#### 1. 장바구니 무료배송 진행바 [8 SP]
**User Story**:
```
AS A 쇼핑 중인 사용자
I WANT TO 무료배송까지 얼마나 남았는지 시각적으로 보고
SO THAT 추가 구매를 통해 배송비를 절약할 수 있다
```

**Acceptance Criteria**:
- [ ] 장바구니에서 현재 금액 대비 무료배송 임계값 표시
- [ ] 진행바 UI (0% ~ 100%)
- [ ] "N원 더 담으면 무료배송!" 메시지
- [ ] 관련 상품 추천 (3개)

**Assignee**: 최현우 (Frontend), 정수진 (Backend)
**Dependencies**: 없음

**Technical Notes**:
```typescript
interface FreeShippingProgress {
  currentAmount: number;
  threshold: number; // 50,000원
  remaining: number;
  progress: number; // 0.0 ~ 1.0
  recommendations: Product[];
}
```

#### 2. 장바구니 리마인더 시스템 [13 SP]
**User Story**:
```
AS A 장바구니에 상품을 담은 사용자
I WANT TO 일정 시간 후 알림을 받고
SO THAT 장바구니를 잊지 않고 구매할 수 있다
```

**Acceptance Criteria**:
- [ ] 푸시 알림 인프라 구축 (Firebase Cloud Messaging)
- [ ] 알림 스케줄러 (1시간 후, 24시간 후, 48시간 후)
- [ ] 이메일 리마인더 템플릿
- [ ] 알림 설정 ON/OFF (사용자 프로필)

**Assignee**: 박성호 (Backend), 한지민 (Infra)
**Dependencies**: 없음

**Technical Notes**:
```yaml
# RabbitMQ Queue
cart_reminder_1h:
  delay: 3600s
  payload:
    userId: "user_123"
    cartId: "cart_abc"
    trigger: "1h"

# Cron Job (node-cron)
# 매 시간마다 체크
0 * * * * /usr/bin/node /app/workers/cart-reminder.js
```

#### 3. 저장된 카드로 원클릭 결제 [8 SP]
**User Story**:
```
AS A 재구매 고객
I WANT TO 저장된 카드 정보로 빠르게 결제하고
SO THAT 결제 과정을 단축할 수 있다
```

**Acceptance Criteria**:
- [ ] 카드 정보 저장 (PG사 토큰화)
- [ ] 저장된 카드 목록 UI
- [ ] 원클릭 결제 버튼
- [ ] 카드 삭제 기능
- [ ] 보안: 카드 정보 암호화, PCI-DSS 준수

**Assignee**: 정수진 (Backend), 최현우 (Frontend)
**Dependencies**: PG사 API 확인 (토스페이먼츠)

**Security Checklist**:
- [ ] 카드번호 직접 저장 금지 (PG 토큰만)
- [ ] SSL/TLS 암호화
- [ ] 카드 정보 로그 남기지 않음
- [ ] 결제 시 CVC 재입력 필수

### Medium Priority (Should Have)

#### 4. A/B 테스트 인프라 [5 SP]
**User Story**:
```
AS A 제품 팀
I WANT TO 여러 버전의 UI를 테스트하고
SO THAT 데이터 기반으로 의사결정할 수 있다
```

**Acceptance Criteria**:
- [ ] Feature Flag 시스템 (LaunchDarkly or 자체 구축)
- [ ] 사용자별 실험 그룹 할당
- [ ] 이벤트 트래킹 (Segment or Mixpanel)
- [ ] 실험 결과 대시보드

**Assignee**: 한지민 (Infra), 박성호 (Backend)
**Dependencies**: 없음

#### 5. 상품 리뷰 이미지 업로드 (Sprint 11 이월) [5 SP]
**Acceptance Criteria**:
- [ ] 이미지 업로드 UI (최대 5장)
- [ ] S3 업로드 (presigned URL)
- [ ] 이미지 리사이징 (Lambda@Edge)
- [ ] 썸네일 생성 (300x300)

**Assignee**: 최현우 (Frontend), 한지민 (Infra)
**Dependencies**: AWS S3, Lambda 설정

### Low Priority (Nice to Have)

#### 6. 장바구니 공유 기능 [8 SP]
**User Story**:
```
AS A 사용자
I WANT TO 친구와 장바구니를 공유하고
SO THAT 함께 주문해서 배송비를 절약할 수 있다
```

**Acceptance Criteria**:
- [ ] 공유 링크 생성 (24시간 유효)
- [ ] 공유 받은 사람이 자신의 장바구니에 추가 가능
- [ ] 공유 링크 복사 버튼
- [ ] SNS 공유 (카카오톡, 라인)

**Assignee**: 정수진 (Backend), 최현우 (Frontend)
**Dependencies**: 없음
**Note**: 시간이 남으면 진행

#### 7. 관리자 대시보드 실시간 차트 [3 SP]
**Acceptance Criteria**:
- [ ] WebSocket 연결로 실시간 업데이트
- [ ] 매출 그래프 (Chart.js)
- [ ] 주문 건수 실시간 표시

**Assignee**: 한지민
**Note**: Stretch Goal

## Sprint Commitment

### Committed (47 SP)
1. 장바구니 무료배송 진행바 (8 SP)
2. 장바구니 리마인더 (13 SP)
3. 원클릭 결제 (8 SP)
4. A/B 테스트 인프라 (5 SP)
5. 리뷰 이미지 업로드 (5 SP)
6. 장바구니 공유 (8 SP)

### Stretch Goals (3 SP)
7. 관리자 실시간 차트 (3 SP)

## Definition of Done (DoD)

각 스토리는 다음 기준을 만족해야 완료:

- [ ] 코드 리뷰 완료 (최소 1명)
- [ ] Unit Test 작성 (커버리지 80% 이상)
- [ ] Integration Test 작성 (API 테스트)
- [ ] QA 테스트 통과
- [ ] 문서 업데이트 (API 문서, README)
- [ ] develop 브랜치에 머지
- [ ] Staging 환경 배포 및 확인

## 리스크 & 대응

### Risk 1: PG사 API 변경
**Impact**: High
**Probability**: Low
**Mitigation**:
- 토스페이먼츠 문서 재확인 (박성호)
- API 변경 시 대체 방안: 기존 결제 플로우 유지

### Risk 2: 푸시 알림 인프라 복잡도
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Spike: Firebase FCM POC (1일, 박성호)
- 대체 방안: 이메일 리마인더만 우선 구현

### Risk 3: A/B 테스트 도구 선택
**Impact**: Low
**Probability**: Medium
**Mitigation**:
- LaunchDarkly vs 자체 구축 비교 (1일, 한지민)
- 결정: 2026-02-12까지

## Daily Standup

- **시간**: 매일 10:00 AM
- **장소**: Zoom (10분)
- **Format**:
  - 어제 한 일
  - 오늘 할 일
  - 블로커

## Sprint Review & Retrospective

- **Sprint Review**: 2026-02-24 (월) 14:00-15:00
- **Retrospective**: 2026-02-24 (월) 15:00-16:00

## Action Items

| 항목 | 담당자 | 기한 |
|------|--------|------|
| Firebase FCM POC | 박성호 | 2026-02-12 |
| PG사 카드 저장 API 확인 | 정수진 | 2026-02-11 |
| A/B 테스트 도구 선택 | 한지민 | 2026-02-12 |
| 장바구니 UI 디자인 | 강태양 | 2026-02-13 |

## Q&A

**Q1 (이지은)**: 장바구니 리마인더, 너무 자주 보내면 스팸 아닌가요?
**A1 (김민수)**: 좋은 지적입니다. 알림 빈도를 제한하고 (최대 주 2회), 사용자가 끌 수 있게 하겠습니다.

**Q2 (정수진)**: 원클릭 결제, 보안 검토는?
**A2 (박성호)**: PG사 토큰만 저장하고, 결제 시 CVC 재입력을 요구합니다. 보안팀 검토 예정.

**Q3 (윤서연)**: QA 테스트 시간은 얼마나?
**A3 (김민수)**: 각 스토리당 0.5일 할당. 총 3일 예상.

## Meeting Notes

- 팀 사기 좋음, Sprint 11 성과에 만족
- 장바구니 최적화가 비즈니스에 큰 영향 예상
- 리뷰 이미지 업로드는 빠르게 완료 예정
- A/B 테스트 인프라는 장기 투자로 중요

---

**다음 미팅**: Daily Standup (2026-02-11, 10:00 AM)
**작성자**: 김민수 (PM)
**배포**: Jira, Slack #engineering
