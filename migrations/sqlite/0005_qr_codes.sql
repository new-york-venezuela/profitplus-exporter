CREATE TABLE `qr_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`logo_mode` text DEFAULT 'default' NOT NULL,
	`logo_path` text,
	`fg_color` text DEFAULT '#000000' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
