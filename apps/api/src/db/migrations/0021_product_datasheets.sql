CREATE TABLE IF NOT EXISTS `product_datasheets` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text DEFAULT '' NOT NULL,
	`doc_id` text DEFAULT '' NOT NULL,
	`effective_date` text DEFAULT '' NOT NULL,
	`prepared_by` text DEFAULT '' NOT NULL,
	`checked_by` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`photo_url` text DEFAULT '' NOT NULL,
	`machine_settings` text DEFAULT '[]' NOT NULL,
	`casting_checks` text DEFAULT '[]' NOT NULL,
	`post_operations` text DEFAULT '[]' NOT NULL,
	`final_inspection` text DEFAULT '' NOT NULL,
	`packaging_instructions` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `datasheet_product_idx` ON `product_datasheets` (`product_id`);
