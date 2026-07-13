CREATE TABLE IF NOT EXISTS `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text DEFAULT '' NOT NULL,
	`date` text DEFAULT '' NOT NULL,
	`in_time` text DEFAULT '' NOT NULL,
	`out_time` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_emp_date_idx` ON `attendance_entries` (`employee_id`,`date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text DEFAULT '' NOT NULL,
	`from_date` text DEFAULT '' NOT NULL,
	`to_date` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text DEFAULT '' NOT NULL,
	`decided_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
