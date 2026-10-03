CREATE TABLE `pricing_promotion_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`promotion_id` integer NOT NULL,
	`co_cli` text NOT NULL,
	`previous_tip_cli` text NOT NULL,
	`moved` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`promotion_id`) REFERENCES `pricing_promotions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_promotion_customers_uniq` ON `pricing_promotion_customers` (`promotion_id`,`co_cli`);--> statement-breakpoint
CREATE TABLE `pricing_promotion_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`promotion_id` integer NOT NULL,
	`co_art` text NOT NULL,
	`co_alma` text,
	`promo_monto` real NOT NULL,
	`regular_monto` real,
	`applied` integer DEFAULT 0 NOT NULL,
	`message` text,
	FOREIGN KEY (`promotion_id`) REFERENCES `pricing_promotions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_promotion_items_uniq` ON `pricing_promotion_items` (`promotion_id`,`co_art`);--> statement-breakpoint
CREATE TABLE `pricing_promotions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`reason` text,
	`kind` text NOT NULL,
	`co_precio` text NOT NULL,
	`base_co_precio` text,
	`tip_cli` text,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`cancelled_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
