CREATE TRIGGER `change_events_block_update`
BEFORE UPDATE ON `change_events`
BEGIN
  SELECT RAISE(ABORT, 'change_events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `change_events_block_delete`
BEFORE DELETE ON `change_events`
BEGIN
  SELECT RAISE(ABORT, 'change_events are append-only');
END;
