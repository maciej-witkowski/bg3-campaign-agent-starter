ALTER TABLE `change_events` ADD `checkpoint_id` text REFERENCES checkpoints(id) ON DELETE restrict;--> statement-breakpoint
CREATE INDEX `change_events_checkpoint_idx` ON `change_events` (`checkpoint_id`);--> statement-breakpoint
UPDATE `checkpoints`
SET `snapshot_format` = 'BG3_LEGACY_CHECKPOINT'
WHERE `snapshot_format` = 'BG3_CAMPAIGN_SNAPSHOT'
  AND `schema_version` = 2;