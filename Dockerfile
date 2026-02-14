FROM node:24-slim AS base

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY admin-ui/ ./admin-ui/
COPY public/ ./public/
COPY config/ ./config/
COPY astro.config.mjs ./
COPY tsconfig.json ./

# Create directories for volumes
RUN mkdir -p source conf data dist

# Environment variables
ENV PORT=3000
ENV ADMIN_EMAIL=""
ENV NODE_ENV=production
ENV SESSION_SECRET=""

# Volumes for persistent data
VOLUME ["/app/source", "/app/conf", "/app/data"]

EXPOSE ${PORT}

CMD ["node", "server/index.js"]
