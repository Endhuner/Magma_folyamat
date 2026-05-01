ALTER TABLE `orders` ADD `product_id` text;--> statement-breakpoint
CREATE INDEX `orders_product_id_idx` ON `orders` (`product_id`);