CREATE TABLE `pricing_alert_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`promotion_id` integer NOT NULL,
	`kind` text NOT NULL,
	`sent_on` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_alert_log_uniq` ON `pricing_alert_log` (`promotion_id`,`kind`);--> statement-breakpoint
CREATE TABLE `pricing_alert_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`days_ahead` integer DEFAULT 7 NOT NULL,
	`recipients` text
);
--> statement-breakpoint
CREATE TABLE `pricing_sweep_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` integer NOT NULL,
	`ok` integer NOT NULL,
	`moved` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`error` text
);
