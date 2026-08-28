CREATE TABLE `invoice_reminder_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_date` text NOT NULL,
	`co_cli` text NOT NULL,
	`email` text NOT NULL,
	`invoice_count` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_reminder_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`threshold_days` integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
INSERT INTO invoice_reminder_settings (threshold_days) VALUES (3);
