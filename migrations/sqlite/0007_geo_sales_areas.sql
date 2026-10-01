CREATE TABLE `sales_area_sellers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`seller_code` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `sales_areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_area_sellers_area_seller_unique` ON `sales_area_sellers` (`area_id`,`seller_code`);--> statement-breakpoint
CREATE TABLE `sales_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`polygon` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_areas_name_unique` ON `sales_areas` (`name`);