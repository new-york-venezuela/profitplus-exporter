CREATE TABLE `seller_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_rep_key` text NOT NULL,
	`period_month` text NOT NULL,
	`sales_quota_usd` real,
	`weekly_visit_quota` integer,
	`new_customer_quota` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seller_targets_rep_month_unique` ON `seller_targets` (`sales_rep_key`,`period_month`);