---
title: 기획 문서 작성 가이드
sidebar:
  label: 기획 문서 가이드
---

# 기획 문서 작성 가이드

이 섹션은 마크다운 기반 기획서 작성 방법과 **화면 미리보기 연동** 사용법을 안내합니다.

## 화면 미리보기 연동이란?

기획 문서 상단의 `frontmatter`에 화면 URL을 지정하면, 오른쪽 사이드바에 **화면 미리보기** 버튼이 나타납니다. 버튼을 클릭하면 모달에서 해당 화면을 **모바일 / 태블릿 / 데스크톱** 크기로 확인할 수 있습니다.

## frontmatter 필드 설명

```yaml
---
title: 문서 제목           # 필수
screen: screens/home.html  # 단일 화면 — 현재 파일 기준 상대경로
screens:                   # 복수 화면 (screen 대신 사용)
  - url: screens/step1.html
    label: "1단계 - 입력"
  - url: screens/step2.html
    label: "2단계 - 확인"
figma: https://figma.com/...  # Figma 링크 (선택)
status: draft               # draft | review | confirmed | dev | done
version: "1.0.0"            # 문서 버전 (선택)
---
```

### `status` 값 안내

| 값 | 표시 | 의미 |
|----|------|------|
| `draft` | 초안 | 작성 중인 초안 |
| `review` | 검토중 | 리뷰 요청 단계 |
| `confirmed` | 확정 | 기획 확정 완료 |
| `dev` | 개발중 | 개발팀 구현 중 |
| `done` | 완료 | 개발 및 배포 완료 |

## 예시 문서 목록

이 섹션에 포함된 샘플 기획서를 참고하세요.

- **[홈 화면 기획서](./01-home)** — 단일 화면, 확정 상태
- **[로그인 기획서](./02-login)** — 단일 화면, 개발 중 상태
- **[상품 목록 기획서](./03-product-list)** — 복수 화면, 검토 중 상태

## 경로 작성 규칙

| 방식 | 예시 | 설명 |
|------|------|------|
| 상대경로 | `screens/home.html` | 현재 마크다운 파일 위치 기준 |
| 절대경로 | `/planning/screens/home.html` | source 루트(`/`) 기준 |
| 외부 URL | `https://staging.example.com` | 외부 주소 그대로 사용 |

## 파일 구조 컨벤션

```
source/
└── planning/
    ├── 00-overview.md        ← 이 파일 (가이드)
    ├── 01-home.md            ← screen: screens/home.html
    ├── 02-login.md           ← screen: screens/login.html
    ├── 03-product-list.md    ← screens: [screens/product-list.html, ...]
    └── screens/              ← HTML 목업은 같은 폴더에 보관
        ├── home.html
        ├── login.html
        └── product-list.html
```

> **팁**: 기획서와 HTML 목업을 같은 폴더에 두고 상대경로로 연결하면 폴더를 옮겨도 경로가 깨지지 않습니다.
