#!/bin/sh
# =============================================================================
# Magma folyamat — Egy-kattintásos frissítő szkript (Unraid host-on fut)
# =============================================================================
# Mit csinál:
#   1. Lehúzza a legfrissebb image-et a ghcr.io-ról
#   2. Csak ha TÉNYLEG új verzió van, akkor állítja le + cseréli a containert
#   3. Pontosan a megfelelő flagekkel indítja újra (br0 / IP / volume-ok / env)
#
# Használat az Unraid szerveren:
#   chmod +x update-magma.sh        # egyszer, a legelső futtatás előtt
#   ./update-magma.sh               # frissítés bármikor
#
# A régi adat NEM vész el: az adatbázis és a PDF-ek a volume-okban élnek,
# nem a containerben.
# =============================================================================

set -e

# ── Beállítások (ha változik valami, csak itt kell átírni) ──────────────────
CONTAINER="magma_folyamat"
IMAGE="ghcr.io/endhuner/magma_folyamat:latest"
IP="192.168.1.5"
NETWORK="br0"
DATA_VOLUME="/mnt/user/appdata/produktivpro/data:/data"
PDF_VOLUME="/mnt/user/Data/Magma - Iroda/CMR:/pdf-output"
PDF_OUTPUT_DIR="/pdf-output"

echo "=========================================="
echo "[update] Magma frissítés indul: $(date)"
echo "[update] Image: $IMAGE"
echo "=========================================="

# ── 1. Jelenlegi image-azonosító elmentése (összehasonlításhoz) ─────────────
OLD_ID=$(docker inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null || echo "none")

# ── 2. Legfrissebb image lehúzása ───────────────────────────────────────────
echo "[update] Image letöltése a ghcr.io-ról..."
docker pull "$IMAGE"

NEW_ID=$(docker inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null || echo "none")

# ── 3. Ha nincs új verzió ÉS a container fut, nincs teendő ──────────────────
RUNNING=$(docker ps -q -f "name=^${CONTAINER}$" || true)
if [ "$OLD_ID" = "$NEW_ID" ] && [ -n "$RUNNING" ]; then
  echo "[update] Már a legfrissebb verzió fut — nincs teendő. ✓"
  echo "=========================================="
  exit 0
fi

# ── 4. Régi container leállítása és törlése (ha létezik) ─────────────────────
if [ -n "$(docker ps -aq -f "name=^${CONTAINER}$")" ]; then
  echo "[update] Régi container leállítása és törlése..."
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  docker rm "$CONTAINER" >/dev/null 2>&1 || true
fi

# ── 5. Új container indítása a helyes flagekkel ─────────────────────────────
echo "[update] Új container indítása..."
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK" \
  --ip "$IP" \
  -v "$DATA_VOLUME" \
  -v "$PDF_VOLUME" \
  -e PDF_OUTPUT_DIR="$PDF_OUTPUT_DIR" \
  "$IMAGE"

echo "=========================================="
echo "[update] Kész! ✓  Az app elérhető: http://$IP"
echo "[update] Napló megtekintése:  docker logs -f $CONTAINER"
echo "=========================================="

# ── 6. (Opcionális) régi, használaton kívüli image-ek takarítása ────────────
# Kikommentezve hagyva — ha be akarod kapcsolni, vedd ki a # jelet:
# echo "[update] Régi image-ek takarítása..."
# docker image prune -f >/dev/null 2>&1 || true
