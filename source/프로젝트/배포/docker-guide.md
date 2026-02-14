# Docker 배포 가이드

## 빌드

```bash
docker build -t git-docs-app .
```

## 실행

```bash
docker run -d \
  --name my-wiki \
  -p 8080:3000 \
  -v $(pwd)/source:/app/source \
  -v $(pwd)/conf:/app/conf \
  -v $(pwd)/data:/app/data \
  -e ADMIN_EMAIL=admin@gmail.com \
  git-docs-app
```

## 멀티 인스턴스

서로 다른 포트로 여러 위키를 동시에 운영할 수 있습니다.

```bash
# 프로젝트 A
docker run -p 8080:3000 -v ./proj-a:/app/source git-docs-app

# 프로젝트 B
docker run -p 8081:3000 -v ./proj-b:/app/source git-docs-app
```
