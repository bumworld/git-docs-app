# ── Builder: 네이티브 모듈(better-sqlite3 등) 컴파일용 툴체인 포함 ──
FROM node:24-slim AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN HUSKY=0 npm ci --omit=dev

# ── Runtime: 툴체인 없이 컴파일된 node_modules + 앱 소스만 ──
# builder 와 동일한 node:24-slim 베이스라 네이티브 바이너리 ABI 호환.
FROM node:24-slim AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy application source
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY admin-ui/ ./admin-ui/
COPY user-ui/ ./user-ui/
COPY shared-ui/ ./shared-ui/
COPY public/ ./public/
COPY config/ ./config/
COPY astro.config.mjs ./
COPY tsconfig.json ./

# Create directories for volumes
RUN mkdir -p source conf data dist

# Environment variables
# ADMIN_EMAIL / SESSION_SECRET 은 런타임에 -e 또는 --env-file 로 주입한다.
# (코드에 기본값 fallback 이 있으므로 이미지에 굽지 않는다)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE ${PORT}

CMD ["node", "server/index.js"]
