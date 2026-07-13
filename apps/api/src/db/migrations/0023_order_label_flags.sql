ALTER TABLE `orders` ADD COLUMN `label_done_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `pallet_label_done_at` text DEFAULT '' NOT NULL;
