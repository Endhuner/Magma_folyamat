CREATE TABLE IF NOT EXISTS `trash` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_label` text DEFAULT '' NOT NULL,
	`entity_name` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`deleted_by` text DEFAULT '' NOT NULL,
	`deleted_by_name` text DEFAULT '' NOT NULL,
	`deleted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trash_deleted_at_idx` ON `trash` (`deleted_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trash_entity_idx` ON `trash` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `machine_maintenance` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_id` text NOT NULL,
	`type` text DEFAULT 'scheduled' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`performed_at` text DEFAULT '' NOT NULL,
	`next_due_at` text DEFAULT '' NOT NULL,
	`cost` text DEFAULT '' NOT NULL,
	`performed_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `machine_maintenance_machine_idx` ON `machine_maintenance` (`machine_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `machine_maintenance_due_idx` ON `machine_maintenance` (`next_due_at`);
