-- 0007: machines.photo_url oszlop biztonságos hozzáadása
-- IF NOT EXISTS: idempotens — ha már létezik az oszlop (mert 0006 lefutott),
-- nem dob hibát. Ha nem létezik (régi DB), hozzáadja.
-- SQLite 3.37.0+ (Alpine node:22 → 3.45+) támogatja ezt a szintaxist.

ALTER TABLE machines ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
