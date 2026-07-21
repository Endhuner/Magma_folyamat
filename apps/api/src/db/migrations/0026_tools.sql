CREATE TABLE IF NOT EXISTS `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`size` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`stock` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'db' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`purchase_price` real DEFAULT 0 NOT NULL,
	`purchased_at` text DEFAULT '' NOT NULL,
	`suppliers` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
