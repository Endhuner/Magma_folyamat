#!/bin/sh
# =============================================================================
# ProduktívPro — indítószkript
# =============================================================================
# 1. JWT_SECRET biztosítása: env → mentett fájl → automatikus generálás
# 2. DB migrációk futtatása (idempotens)
# 3. Node.js szerver indítása
# =============================================================================

set -e

DATA_DIR="/data"
SECRET_FILE="$DATA_DIR/.jwt_secret"

# ── 1. JWT_SECRET kezelése ────────────────────────────────────────────────
if [ -z "$JWT_SECRET" ]; then
  if [ -f "$SECRET_FILE" ]; then
    JWT_SECRET=$(cat "$SECRET_FILE")
    echo "[startup] JWT_SECRET betöltve a mentett fájlból."
  else
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
    mkdir -p "$DATA_DIR"
    printf '%s' "$JWT_SECRET" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    echo "[startup] JWT_SECRET automatikusan generálva és elmentve."
  fi
else
  echo "[startup] JWT_SECRET környezeti változóból olvasva."
fi
export JWT_SECRET

# ── 2. DB migrációk ───────────────────────────────────────────────────────
echo "[startup] Adatbázis migrációk..."
cd /app/apps/api
node dist/db/migrate.js
echo "[startup] Migrációk kész."

# ── 3. Node.js szerver indítása ───────────────────────────────────────────
echo "[startup] ProduktívPro szerver indul (port: ${PORT:-5050})..."
exec node dist/index.js
