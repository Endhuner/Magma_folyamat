-- 0004: machines táblához JSON mezők (oils, accessories, repairs) és createdBy
--        materials táblához createdBy

ALTER TABLE machines ADD COLUMN oils TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE machines ADD COLUMN accessories TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE machines ADD COLUMN repairs TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE machines ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE materials ADD COLUMN created_by TEXT;
