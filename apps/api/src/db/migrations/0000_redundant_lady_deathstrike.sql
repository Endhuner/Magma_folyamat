CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_label` text DEFAULT '' NOT NULL,
	`entity_id` text NOT NULL,
	`entity_name` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`changes` text,
	`notes` text,
	`user_id` text,
	`user_name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`full_address` text DEFAULT '' NOT NULL,
	`tax_number` text DEFAULT '' NOT NULL,
	`delivery_template_id` text,
	`cmr_template_id` text,
	`label_template_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `delivery_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`sequence_number` text DEFAULT '' NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`order_ids` text DEFAULT '[]' NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`export_date` text DEFAULT '' NOT NULL,
	`export_data` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_notes_type_idx` ON `delivery_notes` (`type`);--> statement-breakpoint
CREATE INDEX `delivery_notes_customer_idx` ON `delivery_notes` (`customer`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`drawing_number` text DEFAULT '' NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`total_shots` integer,
	`nest_count` text,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_updated` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_product_idx` ON `inventory_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_item_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`order_id` text,
	`shift_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_tx_item_idx` ON `inventory_transactions` (`inventory_item_id`);--> statement-breakpoint
CREATE INDEX `inv_tx_order_idx` ON `inventory_transactions` (`order_id`);--> statement-breakpoint
CREATE INDEX `inv_tx_shift_idx` ON `inventory_transactions` (`shift_id`);--> statement-breakpoint
CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`capacity` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`supplier` text DEFAULT '' NOT NULL,
	`unit_price` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`designation` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`own_order_number` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`order_number` text DEFAULT '' NOT NULL,
	`amount_pc` integer DEFAULT 0 NOT NULL,
	`order_date` text DEFAULT '' NOT NULL,
	`required_date` text DEFAULT '' NOT NULL,
	`pickup_date` text DEFAULT '' NOT NULL,
	`invoiced` text DEFAULT '' NOT NULL,
	`ready` text DEFAULT '' NOT NULL,
	`surface_treatment` text DEFAULT '' NOT NULL,
	`boxes_count` integer,
	`pallets_count` integer,
	`gross_weight_kg` text DEFAULT '' NOT NULL,
	`required_material_kg` text DEFAULT '' NOT NULL,
	`planned_production_hours` text DEFAULT '' NOT NULL,
	`delivery_note` text DEFAULT '' NOT NULL,
	`cmr` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Felvéve' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer`);--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `production_defects` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`shift_id` text,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `defects_order_idx` ON `production_defects` (`order_id`);--> statement-breakpoint
CREATE INDEX `defects_shift_idx` ON `production_defects` (`shift_id`);--> statement-breakpoint
CREATE TABLE `production_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`order_id` text NOT NULL,
	`action` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plog_order_idx` ON `production_logs` (`order_id`);--> statement-breakpoint
CREATE TABLE `production_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`date` text NOT NULL,
	`shift` text NOT NULL,
	`shots_count` integer DEFAULT 0 NOT NULL,
	`produced_quantity` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE INDEX `shifts_order_idx` ON `production_shifts` (`order_id`);--> statement-breakpoint
CREATE INDEX `shifts_date_idx` ON `production_shifts` (`date`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`drawing_number` text DEFAULT '' NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`nest_count` text DEFAULT '' NOT NULL,
	`weight_per_piece` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`surface_treatment` text DEFAULT '' NOT NULL,
	`cycle_time` text DEFAULT '' NOT NULL,
	`post_processing_time` text DEFAULT '' NOT NULL,
	`post_processing` text DEFAULT '' NOT NULL,
	`box_size` text DEFAULT '' NOT NULL,
	`pieces_per_box` text DEFAULT '' NOT NULL,
	`boxes_per_pallet` text DEFAULT '' NOT NULL,
	`article_number` text DEFAULT '' NOT NULL,
	`warehouse` text DEFAULT '' NOT NULL,
	`spru_weight` text DEFAULT '' NOT NULL,
	`auto_update_inventory` integer DEFAULT false,
	`low_stock_threshold` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_drawing_idx` ON `products` (`drawing_number`);--> statement-breakpoint
CREATE INDEX `products_customer_idx` ON `products` (`customer`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'operator' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`pin_hash` text,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_active_idx` ON `users` (`active`);