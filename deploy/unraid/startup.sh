#!/bin/sh
# =============================================================================
# ProduktívPro — indítószkript
# =============================================================================
# 1. /data volume ellenőrzése (perzisztencia diagnózis)
# 2. JWT_SECRET biztosítása
# 3. SQLite backup az indítás előtt (max 7 napi backup megőrizve)
# 4. DB migrációk futtatása (idempotens)
# 5. Node.js szerver indítása
# =============================================================================

set -e

DATA_DIR="/data"
DB_FILE="$DATA_DIR/produktivpro.sqlite"
BACKUP_DIR="$DATA_DIR/backups"
SECRET_FILE="$DATA_DIR/.jwt_secret"
MARKER_FILE="$DATA_DIR/.volume_ok"

# ── 1. /data volume ellenőrzése ───────────────────────────────────────────
echo "[startup] ============================================"
echo "[startup] ProduktívPro indul..."
echo "[startup] Adatkönyvtár: $DATA_DIR"

# Létrehozzuk ha nem létezne (Unraid esetén a host mappát a Docker hozza létre,
# de ha az array nem fut / path nem elérhető, ez fogja jelezni)
mkdir -p "$DATA_DIR"

# Ellenőrzés: a könyvtár írható-e?
if ! touch "$DATA_DIR/.write_test" 2>/dev/null; then
  echo "[startup] HIBA: $DATA_DIR NEM ÍRHATÓ! Ellenőrizd a volume mount konfigurációt."
  echo "[startup] Unraid-en: mkdir -p /mnt/user/appdata/produktivpro"
  exit 1
fi
rm -f "$DATA_DIR/.write_test"

# Ellenőrzés: valódi bind mount-e vagy image belső rétege?
# Ha a MARKER_FILE létezik, már volt sikeres indítás ebben a data könyvtárban.
if [ ! -f "$MARKER_FILE" ]; then
  echo "[startup] FIGYELMEZTETÉS: Első indítás ezen az adatkönyvtáron."
  echo "[startup] Ha ez nem az első futtatás, a volume mount NINCS helyesen bekötve!"
  echo "[startup] Ellenőrizd: -v /mnt/user/appdata/produktivpro:/data"
  date > "$MARKER_FILE"
else
  echo "[startup] Volume OK — perzisztens adatkönyvtár ($(cat $MARKER_FILE | tr -d '\n'))."
fi

# Megmutatjuk hol van az adatbázis és mekkora
if [ -f "$DB_FILE" ]; then
  DB_SIZE=$(du -h "$DB_FILE" 2>/dev/null | cut -f1)
  echo "[startup] Adatbázis: $DB_FILE ($DB_SIZE)"
else
  echo "[startup] Adatbázis még nem létezik — első indítás, létrehozzuk."
fi
echo "[startup] ============================================"

# ── 2. JWT_SECRET kezelése ────────────────────────────────────────────────
if [ -z "$JWT_SECRET" ]; then
  if [ -f "$SECRET_FILE" ]; then
    JWT_SECRET=$(cat "$SECRET_FILE")
    echo "[startup] JWT_SECRET betöltve a mentett fájlból."
  else
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
    printf '%s' "$JWT_SECRET" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    echo "[startup] JWT_SECRET automatikusan generálva és elmentve."
  fi
else
  echo "[startup] JWT_SECRET környezeti változóból olvasva."
fi
export JWT_SECRET

# ── 3. SQLite biztonsági mentés (migráció előtt) ──────────────────────────
if [ -f "$DB_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/produktivpro_${TIMESTAMP}.sqlite"
  cp "$DB_FILE" "$BACKUP_FILE"
  echo "[startup] Backup elkészítve: $BACKUP_FILE"

  # Max 7 backup megőrzése
  BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sqlite 2>/dev/null | wc -l)
  if [ "$BACKUP_COUNT" -gt 7 ]; then
    ls -1t "$BACKUP_DIR"/*.sqlite | tail -n +8 | xargs rm -f
    echo "[startup] Régi backupok törölve (max 7 megőrizve)."
  fi
fi

# ── 4. DB migrációk ───────────────────────────────────────────────────────
echo "[startup] Adatbázis migrációk futtatása..."
cd /app/apps/api
node dist/db/migrate.js
echo "[startup] Migrációk kész."

# ── 5. Node.js szerver indítása ───────────────────────────────────────────
echo "[startup] ProduktívPro szerver indul (port: ${PORT:-5050})..."
exec node dist/index.js
