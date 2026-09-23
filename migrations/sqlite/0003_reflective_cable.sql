CREATE TABLE `visit_cadence_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legal_entity_key` integer,
	`segment_code` text,
	`target_gap_days` integer NOT NULL
);
