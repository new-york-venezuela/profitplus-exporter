CREATE TABLE `pricing_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`before_json` text,
	`after_json` text
);
--> statement-breakpoint
CREATE TABLE `pricing_segment_meta` (
	`tip_cli` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`customer_co_cli` text,
	`reason` text,
	`expires_at` text,
	`fallback_tip_cli` text,
	`previous_tip_cli` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
