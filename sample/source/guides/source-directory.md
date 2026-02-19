---
title: "source/ 디렉토리 구조 가이드"
sidebar:
  label: "source/ 디렉토리 구조"
---

# source/ 디렉토리 구조 가이드

`source/` 디렉토리에 파일을 배치하면 빌드 시 자동으로 문서 사이트로 변환됩니다.
파일 종류와 디렉토리 이름에 따라 처리 방식이 달라집니다.

## 처리 규칙 요약

| 종류 | 조건 | 결과 |
|------|------|------|
| 마크다운 파일 | `.md`, `.mdx` | 문서 페이지로 변환, 사이드바에 노출 |
| HTML 앱 폴더 | 폴더 안에 `index.html` 존재 | `iframe` 문서 페이지 생성 + `/downloads/{폴더명}/`으로 정적 서빙 |
| 이미지 파일 | `.png`, `.jpg`, `.svg` 등 | 이미지 뷰어 문서 페이지 생성 + `/downloads/{경로}`로 서빙 |
| 에셋 파일 | `.json`, `.pdf`, `.csv` 등 | 다운로드 링크 문서 페이지 생성 + `/downloads/{경로}`로 서빙 |
| **`_static/` 디렉토리** | 폴더 이름이 정확히 `_static` | **문서 페이지 생성 없이** `/downloads/` 하위로만 복사 |

---

## 마크다운 파일

`.md`, `.mdx`, `.mdoc` 파일은 문서 페이지로 변환되어 사이드바에 노출됩니다.

```
source/
└── guides/
    └── quick-start.md   →   /guides/quick-start 페이지
```

---

## HTML 앱 폴더

폴더 안에 `index.html`이 존재하면 **HTML 앱 폴더**로 인식합니다.
폴더 전체가 `/downloads/{폴더명}/`으로 복사되고, 문서 사이트에는 `iframe` 프리뷰 페이지가 생성됩니다.

```
source/
└── dashboard/
    ├── index.html       →   iframe 문서 페이지 + /downloads/dashboard/ 정적 서빙
    ├── js/main.js
    └── css/style.css
```

HTML 앱 내부에서 데이터 파일을 fetch할 때는 `/downloads/{폴더명}/` 기준으로 경로를 계산하세요.

---

## _static/ 디렉토리 (정적 파일 전용)

이름이 정확히 `_static`인 디렉토리는 **문서 페이지가 생성되지 않고** `/downloads/`에만 복사됩니다.
사이드바에 노출하지 않고 정적으로 서빙하고 싶은 파일(JSON 데이터, 설정 파일 등)에 사용합니다.

```
source/
└── _static/
    └── data/
        └── 2026-02.json   →   /downloads/data/2026-02.json (사이드바 노출 없음)
```

### 언제 사용하나요?

- HTML 앱이 fetch로 읽어야 하는 JSON 데이터 파일
- 사이트 사이드바에 노출되면 안 되는 설정/리소스 파일
- 앱 외부에서 직접 URL로 접근해야 하는 정적 파일

### 일반 디렉토리와의 차이

```
# 일반 디렉토리: 문서 페이지 + downloads 복사 모두 발생
source/data/2026-02.json
  → /guides/data/2026-02 페이지 생성 (사이드바 노출)
  → /downloads/data/2026-02.json 복사

# _static 디렉토리: downloads 복사만 발생
source/_static/data/2026-02.json
  → /downloads/data/2026-02.json 복사만 (사이드바 노출 없음)
```

---

## 무시되는 디렉토리

다음 디렉토리는 처리에서 제외됩니다.

- `node_modules`, `.git`, `dist`, `build`, `.cache`
- `pwa` (PWA 전용 리소스)
- `.DS_Store`, `Thumbs.db`, `.gitkeep` 파일

---

## 전체 예시

```
source/
├── README.md                    → 홈 페이지
├── guides/
│   └── quick-start.md           → /guides/quick-start 페이지
├── dashboard/                   → HTML 앱 (index.html 포함)
│   ├── index.html               → /dashboard 페이지 (iframe) + /downloads/dashboard/
│   ├── js/main.js
│   └── css/style.css
└── _static/                     → 정적 파일 전용 (사이드바 노출 없음)
    └── data/
        └── 2026-02.json         → /downloads/data/2026-02.json
```
