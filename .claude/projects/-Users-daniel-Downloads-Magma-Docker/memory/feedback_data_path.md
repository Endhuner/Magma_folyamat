---
name: feedback_data_path
description: Az adatbázis volume mount helyes útvonala /data alkönyvtárba kell mutatni
metadata:
  type: feedback
---

A Docker volume mount helyes útvonala: `/mnt/user/appdata/produktivpro/data:/data`

**Why:** Ha csak `/mnt/user/appdata/produktivpro:/data`-t használunk, az SQLite fájl a `produktivpro/` gyökerébe kerül a `data/` alkönyvtár helyett — ez adatvesztési kockázat és eltér az elvárt könyvtárstruktúrától.

**How to apply:** Minden docker run parancsban, build-and-deploy.sh-ban és compose fájlban a `-v` flag legyen: `/mnt/user/appdata/produktivpro/data:/data`.
