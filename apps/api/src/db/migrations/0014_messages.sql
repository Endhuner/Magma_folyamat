CREATE TABLE IF NOT EXISTS `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'uzenet' NOT NULL,
	`body` text NOT NULL,
	`from_user_id` text DEFAULT '' NOT NULL,
	`from_user_name` text DEFAULT '' NOT NULL,
	`to_user_id` text NOT NULL,
	`to_user_name` text DEFAULT '' NOT NULL,
	`read_at` text DEFAULT '' NOT NULL,
	`done_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_to_idx` ON `messages` (`to_user_id`,`created_at`);
