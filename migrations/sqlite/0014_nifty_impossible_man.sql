CREATE TABLE `mapping_apply_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`mapping_file` text NOT NULL,
	`status` text NOT NULL,
	`snapshot` text NOT NULL
);
