-- 0004: machines táblához JSON mezők (oils, accessories, repairs) és createdBy
--        materials táblához createdBy

ALTER TABLE machines ADD COLUMN oils TEXT NOT NULL DEFAULT '[]';
ALTER TABLE machines ADD COLUMN accessories TEXT NOT NULL DEFAULT '[]';
ALTER TABLE machines ADD COLUMN repairs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE machines ADD COLUMN created_by TEXT;

ALTER TABLE materials ADD COLUMN created_by TEXT;
