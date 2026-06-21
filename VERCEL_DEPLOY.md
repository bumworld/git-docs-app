# Vercel 배포 가이드 (샘플 데모용)

샘플 마크다운 문서를 Vercel에 무료로 배포하는 방법입니다.

> ⚠️ **데모 전용 — 실서비스로 사용하지 마세요.**
> `vercel.json` 의 `DEV_MODE=true` 는 Google 인증을 **전체 우회**하여 누구나 접근할 수 있고,
> `USE_SAMPLE_DIR=true` 는 실제 콘텐츠 대신 `sample/` 을 서빙합니다.
> 실서비스 배포 시 `DEV_MODE` 를 제거(또는 `false`)하고, `USE_SAMPLE_DIR` 제거 후
> `SOURCE_DIR`/`CONF_DIR`/`DATA_DIR` 로 실제 경로를 지정하고 `google_auth.json` 을 주입하세요.

## 🎯 배포 특징

- ✅ **인증 없이 공개 접근** (DEV_MODE 자동 활성화)
- ✅ **샘플 데이터 사용** (sample/source/ 문서)
- ✅ **모든 기능 작동** (Rebuild, Admin 패널, Presentation 등)
- ✅ **무료 호스팅** (Vercel Free Tier)
- ✅ **자동 배포** (GitHub push → 자동 빌드 & 배포)

## 📋 배포 단계

### 1. Vercel 계정 생성

1. [https://vercel.com](https://vercel.com) 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 선택 (GitHub 계정으로 로그인)
4. Vercel이 GitHub 레포 접근 권한 요청 → **승인**

> ⚠️ **중요**: 계정 정보는 git에 절대 올라가지 않습니다. vercel.json은 공개 설정 파일입니다.

### 2. 프로젝트 Import

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. **"Import Git Repository"** 섹션에서 `bumworld/git-docs-app` 레포 선택
3. **"Import"** 클릭

### 3. 프로젝트 설정

**Framework Preset**: `Other` (자동 감지됨)

**Build & Development Settings**:
- Build Command: `npm run build` (기본값 그대로)
- Output Directory: (비워두기 - 서버 모드)
- Install Command: `npm install` (기본값 그대로)

**Environment Variables** (중요!):
아래 환경 변수를 추가하세요:

| Key | Value | 설명 |
|-----|-------|------|
| `DEV_MODE` | `true` | 인증 우회 (자동 로그인) |
| `USE_SAMPLE_DIR` | `true` | 샘플 데이터 사용 |
| `NODE_ENV` | `production` | 프로덕션 모드 |

> 💡 환경 변수는 `vercel.json`에도 설정되어 있지만, Vercel 대시보드에서 설정하는 것이 더 안전합니다.

### 4. 배포 시작

1. **"Deploy"** 버튼 클릭
2. 빌드 진행 상황 확인 (약 2-3분 소요)
3. 배포 완료 후 **"Visit"** 버튼으로 사이트 접속

### 5. 배포 완료!

배포된 URL 예시:
```
https://git-docs-app-your-username.vercel.app
```

이제 누구나 이 URL로 샘플 문서를 볼 수 있습니다!

## 🔄 자동 재배포

GitHub에 push하면 자동으로 재배포됩니다:

```bash
git add .
git commit -m "Update sample docs"
git push origin main
```

Vercel이 자동으로 감지해서 새로 빌드 & 배포합니다.

## 🛠️ 문제 해결

### 빌드 실패 시

1. Vercel 대시보드 → 프로젝트 → **"Deployments"** 탭
2. 실패한 배포 클릭 → **"Build Logs"** 확인
3. 에러 메시지 확인 후 수정

### 환경 변수 수정

1. Vercel 대시보드 → 프로젝트 → **"Settings"** 탭
2. **"Environment Variables"** 메뉴
3. 변수 수정 후 **"Save"**
4. **"Redeploy"** 필요 (최근 배포에서 "Redeploy" 버튼)

### 로컬에서 Vercel 환경 테스트

```bash
# Vercel CLI 설치 (선택사항)
npm install -g vercel

# 로컬에서 Vercel 환경 실행
vercel dev
```

## 📊 Vercel Free Tier 제한

- ✅ 대역폭: 100GB/월
- ✅ 빌드 시간: 6000분/월
- ✅ Serverless Function 실행: 100GB-hours/월
- ✅ 커스텀 도메인 지원

샘플 데모 용도로는 충분합니다!

## 🔗 유용한 링크

- [Vercel 문서](https://vercel.com/docs)
- [Vercel + Express 가이드](https://vercel.com/guides/using-express-with-vercel)
- [환경 변수 설정](https://vercel.com/docs/environment-variables)

## 🎉 다음 단계

배포 완료 후:
1. URL을 README.md에 추가
2. GitHub 레포 설명에 "Demo: https://..." 링크 추가
3. 샘플 문서를 추가/수정하면 자동 재배포

---

**문제가 있으면 Vercel 대시보드의 빌드 로그를 확인하세요!**
