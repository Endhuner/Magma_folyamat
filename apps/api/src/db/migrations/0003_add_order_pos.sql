-- Migration 0003: Pos (pozíció) mező hozzáadása a rendelésekhez
-- Minden rendeléshez egész szám pozíció/prioritás szám.
-- NULL = nincs megadva (opcionális mező).

ALTER TABLE `orders` ADD COLUMN `pos` integer;
