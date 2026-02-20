# Git Docs App — 확장 로드맵

현재 아키텍처(단일 서버, SQLite, Astro SSG)를 유지하면서
확장 가능한 구조로 단계적으로 발전시키는 계획입니다.

---

## 현재 상태 (2026-02)

- 단일 Express 서버 + SQLite + Astro Starlight
- 파일 변경 감지 → 증분 재빌드 파이프라인
- 인증: Google OAuth + 세션
- 파일 처리: 마크다운/HTML/이미지/에셋/정적(`__static`, `__raw`, `__ignore`)

---

## Phase 1 — Processor 확장성 ✦ 다음 단계

**목표:** 새 파일 타입이나 디렉토리 규칙을 추가할 때 `processors.js` 핵심 코드를 수정하지 않아도 되는 구조

### 1-1. Processor 플러그인 레지스트리
- `processDirectory`의 if/else 파일타입 분기를 등록 기반 핸들러 맵으로 교체
- 각 핸들러는 `{ match(ext, stats), process(srcFile, ctx) }` 인터페이스
- 기본 핸들러(markdown, html, image, asset, textNoExt)를 레지스트리에 등록
- `config/constants.js`에 FILE_EXTENSIONS가 이미 있으므로 자연스럽게 연결됨

```js
// 목표 인터페이스 예시
registry.register({
  name: 'markdown',
  match: (ext) => FILE_EXTENSIONS.MARKDOWN.includes(ext),
  process: processMarkdownFile,
});
```

### ✅ 1-2. `_prefix` 디렉토리 규칙 시스템 일반화
- ~~현재: `_static` 하드코딩~~
- `__ignore`, `__raw`, `__static` 규칙을 등록 방식으로 구현
- `config/constants.js`에 `DIR_CONVENTIONS` 추가 완료

### ✅ 1-3. 소스 리포별 설정 파일 (`.gitdocs.json`)
- SOURCE 루트에 `.gitdocs.json` 배치로 빌드 동작 커스터마이즈
- `ignorePatterns`: glob 패턴으로 특정 파일/디렉토리 빌드 제외
- `sidebarOrder`: 사이드바 top-level 항목 순서 명시적 지정
- `title`/`description`: DB 미설정 시 사이트 제목/설명 기본값 제공
- 닷 프리픽스 파일 processDirectory에서 자동 무시 추가

---

## Phase 2 — 빌드 파이프라인 개선

**목표:** 빌드 속도와 안정성 향상

### ✅ 2-1. 파일 수준 변경 감지 (증분 빌드)
- ~~prebuild 시 파일 해시(mtime or hash) 캐시 저장~~
- ~~변경되지 않은 파일은 재처리 건너뜀~~
- mtime 기반 캐시 구현 완료 (`data/prebuild-cache.json`)

### 2-2. 빌드 스테이지 훅
- prebuild → astro build → sync 각 단계에 pre/post 훅 삽입 가능
- 예: 빌드 전 외부 데이터 fetch, 빌드 후 CDN 퍼지

### 2-3. 빌드 오류 복구 전략 명확화
- 현재: 실패 시 `dist-old/`에서 복구
- 개선: 롤백 조건 명시, 부분 성공 처리, 재시도 정책

---

## Phase 3 — 서버 구조 정리

**목표:** 라우터 파일이 커질수록 유지보수 가능하게

### 3-1. 서비스 레이어 분리
- 현재: 라우터 핸들러 안에 비즈니스 로직 혼재
- 목표: `server/services/` 디렉토리로 로직 분리
  - `users.service.js`, `builds.service.js`, `settings.service.js`
- 라우터는 요청/응답만, 서비스는 DB + 비즈니스 로직만

### ✅ 3-2. 설정값 타입 강화
- ~~현재: 상태/역할이 문자열 상수로 관리~~
- `USER_STATUS`, `USER_ROLE`을 `config/constants.js`에 상수로 정의 완료
- DB 스키마에 CHECK constraint 추가 완료 (`db.js`)

### ✅ 3-3. 빌드 로그 아카이빙
- ~~현재: 빌드 로그가 DB TEXT 컬럼에 무한 누적~~
- 일정 건수 초과 시 오래된 빌드 레코드 자동 정리 구현 완료 (`cleanupOldBuilds`)

---

## Phase 4 — 규모 확장 (장기)

**목표:** 단일 서버 한계 이후를 대비한 설계

### 4-1. 멀티 소스 리포 지원
- 현재: 소스 디렉토리 1개
- 목표: 여러 리포를 네임스페이스로 구분해 하나의 사이트에 통합
- `/repo-a/...`, `/repo-b/...` URL 구조

### 4-2. 빌드 큐 개선
- 우선순위, 취소, 병렬 스테이지 지원
- 현재 단순 debounce → 명시적 큐 자료구조

### 4-3. 세션/DB 분리 옵션
- 현재: SQLite 단일 파일 (멀티 인스턴스 불가)
- Redis 세션 스토어 옵션 추가
- DB 추상화 레이어(단순 인터페이스)로 교체 용이성 확보

---

## 진행 원칙

- 각 Phase는 독립적으로 진행 가능 (순서 유연)
- 기존 테스트가 통과하는 상태 유지
- 외부 의존성 추가는 최소화 (현재 스택 유지 우선)
- 실제 사용 중인 기능부터 개선 (오버 엔지니어링 지양)
