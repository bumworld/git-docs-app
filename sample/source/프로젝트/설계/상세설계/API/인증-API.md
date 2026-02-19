# 인증 API 상세 설계

## 엔드포인트 목록

### GET /auth/google
구글 OAuth 로그인 시작.

### GET /auth/google/callback
구글 OAuth 콜백 처리.

### GET /auth/logout
세션 파기 후 로그인 페이지로 리다이렉트.

### GET /auth/me
현재 사용자 정보 조회.

## 인증 플로우

```
1. 사용자 → /auth/google
2. Google OAuth 동의 화면
3. Google → /auth/google/callback
4. 세션 생성 → 메인 페이지 리다이렉트
```
