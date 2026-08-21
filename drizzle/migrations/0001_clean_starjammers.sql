CREATE TABLE `inventory_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rolling_window_days` integer DEFAULT 60 NOT NULL,
	`days_of_stock_threshold` integer DEFAULT 7 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_warehouses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`co_alma` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_warehouses_co_alma_unique` ON `inventory_warehouses` (`co_alma`);--> statement-breakpoint
CREATE TABLE `user_modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`module` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO inventory_settings (rolling_window_days, days_of_stock_threshold) VALUES (60, 7);
