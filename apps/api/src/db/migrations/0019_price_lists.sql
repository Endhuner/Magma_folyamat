CREATE TABLE IF NOT EXISTS `price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_id` text DEFAULT '' NOT NULL,
	`burn_rate` real DEFAULT 0.06 NOT NULL,
	`mpb_eur_per_kg` real DEFAULT 0 NOT NULL,
	`current_mp_eur_per_kg` real DEFAULT 0 NOT NULL,
	`mp_history` text DEFAULT '[]' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
