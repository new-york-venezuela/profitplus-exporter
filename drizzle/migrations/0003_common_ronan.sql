CREATE TABLE `recipe_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`line_type` text NOT NULL,
	`co_art` text,
	`manual_label` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`manual_unit_cost_usd` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`co_art` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_co_art_unique` ON `recipes` (`co_art`);