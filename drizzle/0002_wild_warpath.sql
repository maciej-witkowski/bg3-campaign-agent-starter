PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`snapshot_format` text NOT NULL,
	`snapshot_version` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`reason_pl` text NOT NULL,
	`change_event_id` text,
	FOREIGN KEY (`change_event_id`) REFERENCES `change_events`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "checkpoints_required_text" CHECK(length(trim("__new_checkpoints"."id")) > 0 and length(trim("__new_checkpoints"."label")) > 0 and length(trim("__new_checkpoints"."reason_pl")) > 0),
	CONSTRAINT "checkpoints_created_at_valid" CHECK(length("__new_checkpoints"."created_at") = 24 and "__new_checkpoints"."created_at" glob '????-??-??T??:??:??.???Z'),
	CONSTRAINT "checkpoints_snapshot_format_valid" CHECK(length(trim("__new_checkpoints"."snapshot_format")) > 0),
	CONSTRAINT "checkpoints_snapshot_version_valid" CHECK("__new_checkpoints"."snapshot_version" > 0),
	CONSTRAINT "checkpoints_schema_version_valid" CHECK("__new_checkpoints"."schema_version" > 0),
	CONSTRAINT "checkpoints_snapshot_json_valid" CHECK(json_valid("__new_checkpoints"."snapshot_json")),
	CONSTRAINT "checkpoints_sha256_valid" CHECK(length("__new_checkpoints"."snapshot_sha256") = 64 and "__new_checkpoints"."snapshot_sha256" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
INSERT INTO `__new_checkpoints`("id", "label", "created_at", "snapshot_format", "snapshot_version", "schema_version", "snapshot_json", "snapshot_sha256", "reason_pl", "change_event_id") SELECT "id", "label", "created_at", 'BG3_CAMPAIGN_SNAPSHOT', "snapshot_version", 2, "snapshot_json", "snapshot_sha256", "reason_pl", "change_event_id" FROM `checkpoints`;--> statement-breakpoint
DROP TABLE `checkpoints`;--> statement-breakpoint
ALTER TABLE `__new_checkpoints` RENAME TO `checkpoints`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `checkpoints_created_at_idx` ON `checkpoints` (`created_at`);
