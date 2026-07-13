CREATE TABLE IF NOT EXISTS `filled_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`form_type` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
