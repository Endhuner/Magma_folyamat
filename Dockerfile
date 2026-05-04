# =============================================================================
# ProduktívPro — All-in-one Dockerfile (Unraid / egyszerű telepítés)
# =============================================================================
# Egyetlen Node.js folyamat szolgálja ki:
#   • React SPA statikus fájljait (Fastify + @fastify/static)
#   • REST API + SSE végpontokat (/api/v1/...)
#   • SQLite adatbázist (volume: /data)
#
# Nincs nginx, nincs supervisord — csak Node.js.
#
# Build:
#   docker build -f Dockerfile.unraid -t produktivpro:latest .
#
# Futtatás:
#   docker run -d \
#     --name produktivpro \
#     -p 8080:5050 \
#     -v /mnt/user/appdata/produktivpro:/data \
#     -e DEFAULT_ADMIN_PIN=1234 \
#     ghcr.io/OWNER/REPO:latest
#
# Böngészőből: http://<unraid-ip>:8080
# =============================================================================

# ── 1. Frontend build (React/Vite → statikus HTML/CSS/JS) ──────────────────
FROM node:22-alpine AS build-frontend
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ packages/
RUN npm ci

COPY . .
# Csak a frontend SPA-t buildeli (a root vite.config.ts alapján)
RUN npm run build

# ── 2. API build (TypeScript → JavaScript) ─────────────────────────────────
FROM node:22-alpine AS build-api
WORKDIR /repo

# better-sqlite3 natív kompilációhoz szükséges eszközök
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /repo/apps/api
RUN npm run build

# Production-only node_modules (kisebb image)
WORKDIR /repo
RUN npm prune --workspace=@produktivpro/api --omit=dev || true

# ── 3. Runtime image — csak Node.js, semmi más ─────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN mkdir -p /data

# ── API futtatható fájlok ───────────────────────────────────────────────────
COPY --from=build-api /repo/node_modules          ./node_modules
COPY --from=build-api /repo/packages/shared       ./packages/shared
COPY --from=build-api /repo/apps/api/dist         ./apps/api/dist
COPY --from=build-api /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build-api /repo/apps/api/src/db/migrations ./apps/api/dist/db/migrations

# ── Frontend statikus fájlok (a Fastify @fastify/static szolgálja ki) ───────
COPY --from=build-frontend /app/dist ./public

# ── Startup script (JWT_SECRET auto-generálás + DB migráció + szerver) ─────
COPY deploy/unraid/startup.sh /startup.sh
RUN chmod +x /startup.sh

# /data volume: SQLite adatbázis + JWT secret perzisztencia
VOLUME ["/data"]

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5050/health || exit 1

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5050 \
    DATABASE_FILE=/data/produktivpro.sqlite \
    STATIC_DIR=/app/public \
    LOG_LEVEL=info \
    CORS_ORIGIN=* \
    DEFAULT_AUDIT_USER=system \
    SESSION_TTL_SECONDS=28800 \
    COOKIE_SECURE=false \
    DEFAULT_ADMIN_NAME=Admin

CMD ["/startup.sh"]
