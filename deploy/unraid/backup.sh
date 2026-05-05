#!/bin/sh
# =============================================================================
# ProduktívPro — Időszakos biztonsági mentés szkript
# =============================================================================
# Futtatja a crond 6:00-kor és 18:00-kor.
# Naplót ír: /data/backup.log
# Max 14 backup megőrzése (~7 nap, 2 mentés/nap)
# =============================================================================

DATA_DIR="/data"
DB_FILE="$DATA_DIR/produktivpro.sqlite"
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/produktivpro_${TIMESTAMP}.sqlite"

echo "[backup] ============================================"
echo "[backup] Időszakos mentés indul: $(date)"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "[backup] Nincs adatbázis fájl: $DB_FILE — kihagyva."
  exit 0
fi

DB_SIZE=$(du -h "$DB_FILE" 2>/dev/null | cut -f1)
cp "$DB_FILE" "$BACKUP_FILE"
echo "[backup] Mentés kész: $BACKUP_FILE ($DB_SIZE)"

# Max 14 backup megőrzése (2 naponta = ~7 nap visszamenőleg)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sqlite 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 14 ]; then
  ls -1t "$BACKUP_DIR"/*.sqlite | tail -n +15 | xargs rm -f
  echo "[backup] Régi backupok törölve (max 14 megőrizve)."
fi

echo "[backup] ============================================"
