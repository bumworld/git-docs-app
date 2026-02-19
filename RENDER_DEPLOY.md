# Render.com 배포 가이드 (전체 기능 데모)

샘플 마크다운 문서를 Render.com에 무료로 배포하는 방법입니다.

## 🎯 배포 특징

- ✅ **인증 없이 공개 접근** (DEV_MODE 자동 활성화)
- ✅ **샘플 데이터 사용** (sample/source/ 문서)
- ✅ **모든 기능 작동** (Rebuild, Admin 패널, Presentation, SSE 등)
- ✅ **무료 호스팅** (Render Free Tier)
- ✅ **자동 배포** (GitHub push → 자동 빌드 & 배포)
- ✅ **Express 서버 그대로 실행** (Serverless 변환 불필요)

## 📋 배포 단계

### 1. Render 계정 생성

1. [https://render.com](https://render.com) 접속
2. **"Get Started"** 클릭
3. **"Sign in with GitHub"** 선택 (GitHub 계정으로 로그인)
4. Render가 GitHub 레포 접근 권한 요청 → **승인**

> ⚠️ **중요**: 계정 정보는 git에 절대 올라가지 않습니다. render.yaml은 공개 설정 파일입니다.

### 2. 프로젝트 연결

1. Render 대시보드에서 **"New +"** → **"Blueprint"** 클릭
2. **"Connect GitHub"** 섹션에서 `bumworld/git-docs-app` 레포 선택
3. **"Connect"** 클릭

Render가 `render.yaml`을 자동으로 감지합니다!

### 3. Blueprint 설정 확인

Render가 자동으로 읽어온 설정을 확인:

**Service Name**: `git-docs-app`

**Environment**: `node`

**Build Command**: `npm install && npm run build:local`

**Start Command**: `npm start`

**Plan**: `Free` (무료)

**Environment Variables** (자동 설정됨):
| Key | Value | 설명 |
|-----|-------|------|
| `DEV_MODE` | `true` | 인증 우회 (자동 로그인) |
| `USE_SAMPLE_DIR` | `true` | 샘플 데이터 사용 |
| `NODE_ENV` | `production` | 프로덕션 모드 |
| `SESSION_SECRET` | (자동 생성) | 세션 암호화 키 |

**Disk** (persistent storage):
- Name: `git-docs-data`
- Mount Path: `/opt/render/project/src/sample/data`
- Size: 1GB (SQLite DB 저장용)

### 4. 배포 시작

1. **"Apply"** 버튼 클릭
2. 빌드 진행 상황 확인 (약 3-5분 소요)
3. 배포 완료 후 URL 확인

### 5. 배포 완료!

배포된 URL 예시:
```
https://git-docs-app-abc123.onrender.com
```

이제 누구나 이 URL로 샘플 문서를 볼 수 있습니다!

## 🔄 자동 재배포

GitHub에 push하면 자동으로 재배포됩니다:

```bash
git add .
git commit -m "Update sample docs"
git push origin main
```

Render가 자동으로 감지해서 새로 빌드 & 배포합니다.

## 🛠️ 문제 해결

### 빌드 실패 시

1. Render 대시보드 → 서비스 클릭 → **"Logs"** 탭
2. 빌드 로그 확인
3. 에러 메시지 확인 후 수정

### 환경 변수 수정

1. Render 대시보드 → 서비스 클릭 → **"Environment"** 탭
2. 변수 수정 후 **"Save Changes"**
3. 자동으로 재배포됨

### 서비스 재시작

1. Render 대시보드 → 서비스 클릭
2. 우측 상단 **"Manual Deploy"** → **"Clear build cache & deploy"**

### 로컬에서 Render 환경 테스트

```bash
# 환경 변수 설정하고 로컬 실행
DEV_MODE=true USE_SAMPLE_DIR=true npm run dev:local
```

## 📊 Render Free Tier 제한

- ✅ 750시간/월 실행 시간
- ✅ 무료 SSL 인증서
- ✅ 자동 배포
- ⚠️ 15분 비활성 시 sleep (첫 요청 시 30초 대기)
- ✅ Persistent disk 1GB

> 💡 **Sleep 제한**: 무료 플랜은 15분간 요청이 없으면 sleep 됩니다. 첫 방문 시 30초 정도 대기 필요합니다.

## 🚀 Sleep 방지 (선택사항)

항상 깨어있게 하려면:

### 방법 1: Cron Job 설정 (외부)

UptimeRobot 같은 무료 모니터링 서비스로 5분마다 ping:

1. [UptimeRobot](https://uptimerobot.com) 가입
2. Monitor 추가: `https://your-app.onrender.com`
3. Interval: 5분

### 방법 2: GitHub Actions (레포 내)

`.github/workflows/keepalive.yml` 생성:

```yaml
name: Keep Render Alive
on:
  schedule:
    - cron: '*/10 * * * *'  # 10분마다
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render
        run: curl -I https://your-app.onrender.com
```

## 🔗 유용한 링크

- [Render 문서](https://render.com/docs)
- [Render Blueprint 가이드](https://render.com/docs/infrastructure-as-code)
- [환경 변수 설정](https://render.com/docs/environment-variables)

## 🎉 다음 단계

배포 완료 후:
1. URL을 README.md에 추가
2. GitHub 레포 설명에 "Demo: https://..." 링크 추가
3. 샘플 문서를 추가/수정하면 자동 재배포

---

**문제가 있으면 Render 대시보드의 Logs를 확인하세요!**
