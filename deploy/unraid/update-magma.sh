#!/bin/sh
# =============================================================================
# Magma folyamat — Egy-kattintásos frissítő szkript (Unraid host-on fut)
# =============================================================================
# Mit csinál:
#   1. Megkeresi a GHCR-en a LEGÚJABB verzió-taget (pl. v1.40.0) — automatikusan
#   2. Lehúzza pontosan azt a verziót (nem a :latest-et)
#   3. Csak ha TÉNYLEG új verzió van, akkor állítja le + cseréli a containert
#   4. Pontosan a megfelelő flagekkel indítja újra (br0 / IP / volume-ok / env)
#
# Miért verzió-tag és nem :latest?
#   Így az Unraid Docker oldalán az "Image" oszlopban a KONKRÉT verziószám
#   látszik (ghcr.io/.../magma_folyamat:v1.40.0), nem csak az, hogy "latest".
#
# Használat az Unraid szerveren:
#   chmod +x update-magma.sh        # egyszer, a legelső futtatás előtt
#   ./update-magma.sh               # frissítés bármikor
#
# Előfeltétel: egyszeri bejelentkezés a GHCR-re (a token a gépen marad):
#   docker login ghcr.io -u Endhuner   # jelszó helyett a read:packages PAT
#
# A régi adat NEM vész el: az adatbázis és a PDF-ek a volume-okban élnek,
# nem a containerben.
# =============================================================================

set -e

# ── Beállítások (ha változik valami, csak itt kell átírni) ──────────────────
CONTAINER="magma_folyamat"
IMAGE_REPO="ghcr.io/endhuner/magma_folyamat"
REGISTRY_PATH="endhuner/magma_folyamat"   # GHCR útvonal a tag-lekérdezéshez
IP="192.168.1.5"
NETWORK="br0"
DATA_VOLUME="/mnt/user/appdata/produktivpro/data:/data"
PDF_VOLUME="/mnt/user/Data/Magma - Iroda/CMR:/pdf-output"
PDF_OUTPUT_DIR="/pdf-output"

# ── Legújabb verzió-tag automatikus felismerése a GHCR registry API-ból ─────
# A docker login által elmentett hitelesítést használja (~/.docker/config.json).
# Ha bármiért nem sikerül, a :latest-re esik vissza.
detect_latest_version() {
  CONFIG="${HOME}/.docker/config.json"
  [ -f "$CONFIG" ] || return 1

  # Base64 "user:token" kiszedése a ghcr.io bejegyzésből
  BASIC=$(tr -d ' \n' < "$CONFIG" | sed -n 's/.*"ghcr.io":{"auth":"\([^"]*\)".*/\1/p')
  [ -n "$BASIC" ] || return 1

  # Rövid életű pull-token kérése
  TOKEN=$(curl -fsSL -H "Authorization: Basic $BASIC" \
    "https://ghcr.io/token?service=ghcr.io&scope=repository:${REGISTRY_PATH}:pull" \
    | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  [ -n "$TOKEN" ] || return 1

  # Tag-lista lekérése → vX.Y.Z szűrés → legmagasabb verzió
  curl -fsSL -H "Authorization: Bearer $TOKEN" \
    "https://ghcr.io/v2/${REGISTRY_PATH}/tags/list" \
    | tr ',' '\n' \
    | grep -o 'v[0-9][0-9.]*' \
    | sort -V | uniq | tail -1
}

echo "=========================================="
echo "[update] Magma frissítés indul: $(date)"

VERSION=$(detect_latest_version 2>/dev/null || true)
if [ -n "$VERSION" ]; then
  IMAGE="${IMAGE_REPO}:${VERSION}"
  echo "[update] Legújabb verzió a GHCR-en: $VERSION"
else
  IMAGE="${IMAGE_REPO}:latest"
  echo "[update] ⚠ Verzió nem felismerhető (login/hálózat?) — :latest lesz használva"
fi
echo "[update] Image: $IMAGE"
echo "=========================================="

# ── 1. Jelenleg FUTÓ container image-azonosítója (összehasonlításhoz) ────────
OLD_ID=$(docker inspect --format '{{.Image}}' "$CONTAINER" 2>/dev/null || echo "none")

# ── 2. A cél-verzió lehúzása ────────────────────────────────────────────────
echo "[update] Image letöltése a ghcr.io-ról..."
docker pull "$IMAGE"

NEW_ID=$(docker inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null || echo "none")

# ── 3. Ha ugyanaz az image fut már, nincs teendő ────────────────────────────
RUNNING=$(docker ps -q -f "name=^${CONTAINER}$" || true)
if [ "$OLD_ID" = "$NEW_ID" ] && [ -n "$RUNNING" ]; then
  echo "[update] Már a legfrissebb verzió fut ($VERSION) — nincs teendő. ✓"
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
echo "[update] Kész! ✓  Verzió: ${VERSION:-latest}"
echo "[update] Az app elérhető: http://$IP"
echo "[update] Napló megtekintése:  docker logs -f $CONTAINER"
echo "=========================================="

# ── 6. (Opcionális) régi, használaton kívüli image-ek takarítása ────────────
# Kikommentezve hagyva — ha be akarod kapcsolni, vedd ki a # jelet:
# echo "[update] Régi image-ek takarítása..."
# docker image prune -f >/dev/null 2>&1 || true
