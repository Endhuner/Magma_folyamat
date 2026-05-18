#!/bin/bash
# =============================================================================
# ProduktívPro — Mac-on build, Unraid-re deploy
# =============================================================================
# Használat:
#   chmod +x build-and-deploy.sh
#   ./build-and-deploy.sh
#
# Szükséges: Docker Desktop (Mac-en), SCP hozzáférés az Unraid-hez
# =============================================================================

set -e

UNRAID_IP="${UNRAID_IP:-192.168.1.5}"       # Unraid szerver IP
UNRAID_USER="${UNRAID_USER:-root}"
UNRAID_DATA_PATH="/mnt/user/appdata/produktivpro/data"
IMAGE_NAME="produktivpro"
TAR_FILE="produktivpro_new.tar.gz"

echo "============================================"
echo "  ProduktívPro — Docker build + deploy"
echo "============================================"
echo ""

# ── 1. Docker image build ─────────────────────────────────────────────────
echo "[1/4] Docker image build..."
docker build -t ${IMAGE_NAME}:latest .
echo "      ✓ Build kész"
echo ""

# ── 2. Image mentése tar.gz-be ────────────────────────────────────────────
echo "[2/4] Image exportálása: ${TAR_FILE}..."
docker save ${IMAGE_NAME}:latest | gzip > ${TAR_FILE}
echo "      ✓ Exportálás kész ($(du -h ${TAR_FILE} | cut -f1))"
echo ""

# ── 3. Feltöltés Unraid-re ────────────────────────────────────────────────
echo "[3/4] Feltöltés Unraid-re (${UNRAID_USER}@${UNRAID_IP})..."
scp ${TAR_FILE} ${UNRAID_USER}@${UNRAID_IP}:/tmp/${TAR_FILE}
echo "      ✓ Feltöltés kész"
echo ""

# ── 4. Unraid-en: betöltés + konténer újraindítás ─────────────────────────
echo "[4/4] Konténer újraindítása Unraid-en..."
ssh ${UNRAID_USER}@${UNRAID_IP} bash << EOF
  set -e
  echo "  → Docker image betöltése..."
  docker load < /tmp/${TAR_FILE}
  rm -f /tmp/${TAR_FILE}

  echo "  → Régi konténer leállítása..."
  docker stop ${IMAGE_NAME} 2>/dev/null || true
  docker rm   ${IMAGE_NAME} 2>/dev/null || true

  echo "  → Új konténer indítása..."
  docker run -d \\
    --name ${IMAGE_NAME} \\
    --network=br0 \\
    --ip=${UNRAID_IP} \\
    -v ${UNRAID_DATA_PATH}:/data \\
    -e DEFAULT_ADMIN_PIN=\${DEFAULT_ADMIN_PIN:-1234} \\
    --restart=unless-stopped \\
    ${IMAGE_NAME}:latest

  echo "  → Konténer állapota:"
  docker ps | grep ${IMAGE_NAME}
EOF

echo ""
echo "============================================"
echo "  ✓ Deploy kész!"
echo "  Böngészőből: http://${UNRAID_IP}"
echo "============================================"
