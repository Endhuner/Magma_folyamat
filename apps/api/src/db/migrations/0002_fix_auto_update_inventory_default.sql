-- Meglévő termékek auto_update_inventory mezőjének javítása.
-- A DB default korábban false (0) volt, ezért minden termék amely nem kapott
-- explicit értéket, letiltott készletfrissítéssel jött létre.
-- Ez a migráció az összes ilyen terméket engedélyezi.
UPDATE `products` SET `auto_update_inventory` = 1 WHERE `auto_update_inventory` = 0 OR `auto_update_inventory` IS NULL;
