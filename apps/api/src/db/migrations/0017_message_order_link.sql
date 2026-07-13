ALTER TABLE `messages` ADD COLUMN `order_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `order_label` text DEFAULT '' NOT NULL;
