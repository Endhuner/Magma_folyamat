# ProduktívPro — Unraid Docker + GitHub Actions telepítési útmutató

## Áttekintés

```
[GitHub push] → [GitHub Actions: build + GHCR push] → [SSH → Unraid: docker compose pull + up]

[Böngésző] → [Cloudflare Tunnel] → [frontend:8080] → nginx → SPA
                                                             ↓ /api/
                                                          [api:5050] → SQLite
```

**Konténerek:**
- `produktivpro-frontend` — nginx, React SPA + /api/ proxy
- `produktivpro-api` — Node.js/Fastify REST szerver, SQLite adatbázis
- `produktivpro-cloudflared` — Cloudflare Tunnel (internet-elérés, opcionális)

---

## 1. GitHub repo beállítása

### 1.1 GHCR engedélyezése

A GitHub Container Registry alapból engedélyezve van. A repo-nak **nyilvánosnak** kell lennie, VAGY az Unraid-en be kell jelentkezni a GHCR-be (ezt a GitHub Actions elvégzi automatikusan).

Ha a repo privát, a konténerek lehúzásához személyes token kell az Unraid-en:

```bash
# Unraid terminálban:
echo "GITHUB_PAT" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
```

### 1.2 GitHub Secrets beállítása

`Settings → Secrets and variables → Actions → New repository secret`

| Secret neve | Érték |
|---|---|
| `UNRAID_HOST` | Unraid szerver IP (pl. `192.168.1.10`) |
| `UNRAID_USER` | SSH felhasználó (általában `root`) |
| `UNRAID_SSH_KEY` | Privát SSH kulcs (PEM, `-----BEGIN...`-vel kezdődik) |
| `JWT_SECRET` | Véletlen 48 bájt hex string (generálás lent) |
| `DEFAULT_ADMIN_PIN` | Admin PIN az első bejelentkezéshez |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel token (ha kell) |

**JWT_SECRET generálása:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 1.3 SSH kulcs létrehozása az Unraid-hez

Ha még nincs SSH kulcs:
```bash
# A saját gépeden:
ssh-keygen -t ed25519 -C "github-actions-produktivpro" -f ~/.ssh/unraid_deploy

# A publikus kulcsot add hozzá az Unraid-en az authorized_keys-hez:
ssh root@<unraid-ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < ~/.ssh/unraid_deploy.pub

# A privát kulcs tartalma kerül a UNRAID_SSH_KEY secretbe:
cat ~/.ssh/unraid_deploy
```

---

## 2. Unraid szerver előkészítése

### 2.1 Mappa struktúra létrehozása

Unraid terminálban (Settings → Terminal, vagy SSH):

```bash
mkdir -p /mnt/user/appdata/produktivpro/data
mkdir -p /mnt/user/appdata/produktivpro/nginx
```

### 2.2 .env fájl létrehozása

```bash
nano /mnt/user/appdata/produktivpro/.env
```

Tartalom (a `deploy/.env.example` alapján — a repo-ban megtalálod):

```env
GITHUB_OWNER=daniel-vegvari          # kisbetűs GitHub felhasználónév
GITHUB_REPO=produktivpro-tir         # repo neve (kisbetűs)
FRONTEND_PORT=8080
JWT_SECRET=<generált_hex_string>
DEFAULT_ADMIN_NAME=Admin
DEFAULT_ADMIN_PIN=1234
SESSION_TTL_SECONDS=28800
COOKIE_SECURE=false
CORS_ORIGIN=*
CLOUDFLARE_TUNNEL_TOKEN=             # egyelőre üres
```

### 2.3 docker-compose.yml elhelyezése

A GitHub Actions minden deploy-nál feltölti ezt, de az első alkalommal másold kézzel:

```bash
scp deploy/docker-compose.yml root@<unraid-ip>:/mnt/user/appdata/produktivpro/
```

---

## 3. Első manuális indítás (ellenőrzés)

```bash
cd /mnt/user/appdata/produktivpro

# GHCR-ből lehúzza az image-eket (az első GitHub Actions fut után)
docker compose pull

# Elindítja a frontend + api konténereket
docker compose up -d

# Logok ellenőrzése
docker compose logs -f
```

**Smoke teszt:**
```bash
# API health
curl http://localhost:5050/health

# Frontend (Unraid-ről)
curl -I http://localhost:8080

# LAN-ról böngészőből:
# http://<unraid-ip>:8080
```

---

## 4. Cloudflare Tunnel beállítása (internet-elérés)

> **Fontos:** Cloudflare Tunnel-hez domain szükséges.  
> Ingyenes lehetőségek: `eu.org` subdomain (ingyenes), vagy `freenom.com`  
> Cloudflare Registrar-on a legolcsóbb domainek ~$9/év-től.

### 4.1 Tunnel létrehozása

1. Menj: [https://one.dash.cloudflare.com/](https://one.dash.cloudflare.com/)
2. `Networks → Tunnels → Create a tunnel`
3. Válaszd: `Cloudflared` → Add a tunnel name: `produktivpro`
4. Másold a **Tunnel token**-t
5. Kliens beállítás: `Public Hostname`
   - Subdomain: `produktivpro`
   - Domain: a te domained
   - Service: `http://frontend:80`

### 4.2 Token beillesztése

Az Unraid szerver `.env` fájljában:
```env
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiXXXXXX...
```

Ha van domain, szűkítsd a CORS-t:
```env
CORS_ORIGIN=https://produktivpro.pelda.hu
```

### 4.3 Cloudflare Tunnel konténer indítása

```bash
cd /mnt/user/appdata/produktivpro
docker compose --profile cloudflare up -d cloudflared
```

---

## 5. GitHub Actions automatikus deploy

Minden `main` ágra pushold kód után:

1. **GitHub Actions** lebuildi a frontend és API Docker image-eket
2. Feltölti a GHCR-be (`ghcr.io/felhasználónév/repo/frontend:latest`)
3. SSH-val bejelentkezik az Unraid-re
4. `docker compose pull` + `docker compose up -d --remove-orphans`

Az Unraid-en lévő `.env` fájl **érintetlen marad** — csak a konténerek frissülnek.

---

## 6. Adatmentés (CA Backup)

Az SQLite adatbázis helye: `/mnt/user/appdata/produktivpro/data/produktivpro.sqlite`

A CA Backup plugin automatikusan menti az egész `/mnt/user/appdata/` mappát.

**Kézi mentés:**
```bash
cp /mnt/user/appdata/produktivpro/data/produktivpro.sqlite \
   /mnt/user/backups/produktivpro-$(date +%Y%m%d).sqlite
```

---

## 7. Frissítés (deploy után)

A GitHub Actions elvégzi automatikusan. Ha manuálisan kell:

```bash
cd /mnt/user/appdata/produktivpro
docker compose pull
docker compose up -d
docker image prune -f
```

---

## Hibaelhárítás

| Probléma | Megoldás |
|---|---|
| `JWT_SECRET hiányzik` | Töltsd ki az .env-ben, legalább 32 karakter |
| `produktivpro-api` nem indul | `docker logs produktivpro-api` — nézd a hibát |
| Frontend nem éri el az API-t | Ellenőrizd, hogy mindkét konténer ugyanazon a `produktivpro` hálózaton van: `docker network inspect produktivpro` |
| Cloudflare Tunnel "offline" | Ellenőrizd a TUNNEL_TOKEN értékét; `docker logs produktivpro-cloudflared` |
| CA Backup nem menti az adatokat | Ellenőrizd a bind mount-ot: `docker inspect produktivpro-api \| grep Mounts` |
