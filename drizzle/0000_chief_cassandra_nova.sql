CREATE TABLE `abilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name_pl` text NOT NULL,
	`normalized_name_pl` text NOT NULL,
	`name_en` text,
	`type` text NOT NULL,
	`description_pl` text,
	`verification_status` text NOT NULL,
	`notes` text,
	CONSTRAINT "abilities_required_text" CHECK(length(trim("abilities"."id")) > 0 and length(trim("abilities"."name_pl")) > 0 and length(trim("abilities"."normalized_name_pl")) > 0),
	CONSTRAINT "abilities_type_valid" CHECK("abilities"."type" in ('CANTRIP', 'FEAT', 'INVOCATION', 'MANEUVER', 'CLASS_FEATURE', 'PACT', 'PASSIVE')),
	CONSTRAINT "abilities_status_valid" CHECK("abilities"."verification_status" in ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'CONFLICT'))
);
--> statement-breakpoint
CREATE INDEX `abilities_normalized_name_idx` ON `abilities` (`normalized_name_pl`);--> statement-breakpoint
CREATE TABLE `change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`type` text NOT NULL,
	`character_id` text,
	`proposal_id` text,
	`summary_pl` text NOT NULL,
	`reason_pl` text,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`reverses_change_event_id` text,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reverses_change_event_id`) REFERENCES `change_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "change_events_required_text" CHECK(length(trim("change_events"."id")) > 0 and length(trim("change_events"."type")) > 0 and length(trim("change_events"."summary_pl")) > 0),
	CONSTRAINT "change_events_occurred_at_valid" CHECK(length("change_events"."occurred_at") = 24 and "change_events"."occurred_at" glob '????-??-??T??:??:??.???Z'),
	CONSTRAINT "change_events_json_valid" CHECK(json_valid("change_events"."before_json") and json_valid("change_events"."after_json")),
	CONSTRAINT "change_events_reversal_valid" CHECK("change_events"."reverses_change_event_id" is null or "change_events"."reverses_change_event_id" <> "change_events"."id")
);
--> statement-breakpoint
CREATE INDEX `change_events_occurred_at_idx` ON `change_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `change_events_character_idx` ON `change_events` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `change_events_reverses_unique` ON `change_events` (`reverses_change_event_id`);--> statement-breakpoint
CREATE TABLE `character_abilities` (
	`character_id` text NOT NULL,
	`ability_id` text NOT NULL,
	`source` text NOT NULL,
	`level_acquired` integer,
	`notes` text,
	PRIMARY KEY(`character_id`, `ability_id`, `source`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "character_abilities_source_valid" CHECK(length(trim("character_abilities"."source")) > 0),
	CONSTRAINT "character_abilities_level_valid" CHECK("character_abilities"."level_acquired" is null or "character_abilities"."level_acquired" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE `character_attributes` (
	`character_id` text NOT NULL,
	`attribute` text NOT NULL,
	`base_value` integer NOT NULL,
	PRIMARY KEY(`character_id`, `attribute`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "character_attributes_attribute_valid" CHECK("character_attributes"."attribute" in ('STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA')),
	CONSTRAINT "character_attributes_base_value_valid" CHECK("character_attributes"."base_value" between 1 and 30)
);
--> statement-breakpoint
CREATE TABLE `character_illithid_powers` (
	`character_id` text NOT NULL,
	`power_id` text NOT NULL,
	`acquired_at` text,
	`acquisition_source_pl` text,
	`notes` text,
	PRIMARY KEY(`character_id`, `power_id`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`power_id`) REFERENCES `illithid_powers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "character_illithid_powers_acquired_at_valid" CHECK("character_illithid_powers"."acquired_at" is null or length("character_illithid_powers"."acquired_at") = 24 and "character_illithid_powers"."acquired_at" glob '????-??-??T??:??:??.???Z')
);
--> statement-breakpoint
CREATE TABLE `character_spells` (
	`character_id` text NOT NULL,
	`spell_id` text NOT NULL,
	`source` text NOT NULL,
	`known` integer NOT NULL,
	`prepared` integer NOT NULL,
	`always_prepared` integer NOT NULL,
	`notes` text,
	PRIMARY KEY(`character_id`, `spell_id`, `source`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spell_id`) REFERENCES `spells`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "character_spells_source_valid" CHECK("character_spells"."source" in ('CLASS', 'SPELLBOOK', 'PACT', 'DOMAIN', 'ITEM', 'INVOCATION', 'RACE', 'FEAT', 'OTHER')),
	CONSTRAINT "character_spells_booleans_valid" CHECK("character_spells"."known" in (0, 1) and "character_spells"."prepared" in (0, 1) and "character_spells"."always_prepared" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`display_name_pl` text NOT NULL,
	`race_pl` text,
	`class_pl` text NOT NULL,
	`subclass_pl` text,
	`level` integer NOT NULL,
	`role_summary` text NOT NULL,
	`active_party` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "characters_required_text" CHECK(length(trim("characters"."id")) > 0 and length(trim("characters"."canonical_name")) > 0 and length(trim("characters"."display_name_pl")) > 0 and length(trim("characters"."class_pl")) > 0 and length(trim("characters"."role_summary")) > 0),
	CONSTRAINT "characters_level_valid" CHECK("characters"."level" between 1 and 20),
	CONSTRAINT "characters_active_party_boolean" CHECK("characters"."active_party" in (0, 1)),
	CONSTRAINT "characters_instants_valid" CHECK(length("characters"."created_at") = 24 and "characters"."created_at" glob '????-??-??T??:??:??.???Z' and length("characters"."updated_at") = 24 and "characters"."updated_at" glob '????-??-??T??:??:??.???Z')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_canonical_name_unique` ON `characters` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`snapshot_version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`reason_pl` text NOT NULL,
	`change_event_id` text,
	FOREIGN KEY (`change_event_id`) REFERENCES `change_events`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "checkpoints_required_text" CHECK(length(trim("checkpoints"."id")) > 0 and length(trim("checkpoints"."label")) > 0 and length(trim("checkpoints"."reason_pl")) > 0),
	CONSTRAINT "checkpoints_created_at_valid" CHECK(length("checkpoints"."created_at") = 24 and "checkpoints"."created_at" glob '????-??-??T??:??:??.???Z'),
	CONSTRAINT "checkpoints_snapshot_version_valid" CHECK("checkpoints"."snapshot_version" > 0),
	CONSTRAINT "checkpoints_snapshot_json_valid" CHECK(json_valid("checkpoints"."snapshot_json")),
	CONSTRAINT "checkpoints_sha256_valid" CHECK(length("checkpoints"."snapshot_sha256") = 64 and "checkpoints"."snapshot_sha256" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `checkpoints_created_at_idx` ON `checkpoints` (`created_at`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`inventory_item_id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`slot` text NOT NULL,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "equipment_slot_valid" CHECK("equipment"."slot" in ('HEAD', 'CLOAK', 'BODY', 'HANDS', 'FEET', 'NECK', 'RING_1', 'RING_2', 'MAIN_HAND', 'OFF_HAND', 'RANGED_MAIN_HAND', 'RANGED_OFF_HAND', 'INSTRUMENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_character_slot_unique` ON `equipment` (`character_id`,`slot`);--> statement-breakpoint
CREATE TABLE `illithid_power_prerequisites` (
	`power_id` text NOT NULL,
	`prerequisite_power_id` text NOT NULL,
	PRIMARY KEY(`power_id`, `prerequisite_power_id`),
	FOREIGN KEY (`power_id`) REFERENCES `illithid_powers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prerequisite_power_id`) REFERENCES `illithid_powers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "illithid_power_prerequisites_not_self" CHECK("illithid_power_prerequisites"."power_id" <> "illithid_power_prerequisites"."prerequisite_power_id")
);
--> statement-breakpoint
CREATE TABLE `illithid_powers` (
	`id` text PRIMARY KEY NOT NULL,
	`name_pl` text NOT NULL,
	`normalized_name_pl` text NOT NULL,
	`name_en` text,
	`tier` integer,
	`description_pl` text,
	`verification_status` text NOT NULL,
	`notes` text,
	CONSTRAINT "illithid_powers_required_text" CHECK(length(trim("illithid_powers"."id")) > 0 and length(trim("illithid_powers"."name_pl")) > 0 and length(trim("illithid_powers"."normalized_name_pl")) > 0),
	CONSTRAINT "illithid_powers_tier_valid" CHECK("illithid_powers"."tier" is null or "illithid_powers"."tier" between 1 and 10),
	CONSTRAINT "illithid_powers_status_valid" CHECK("illithid_powers"."verification_status" in ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'CONFLICT'))
);
--> statement-breakpoint
CREATE INDEX `illithid_powers_normalized_name_idx` ON `illithid_powers` (`normalized_name_pl`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`item_definition_id` text NOT NULL,
	`status` text NOT NULL,
	`owner_character_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`obtained_at` text,
	`obtained_location` text,
	`notes` text,
	FOREIGN KEY (`item_definition_id`) REFERENCES `item_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_items_id_valid" CHECK(length(trim("inventory_items"."id")) > 0),
	CONSTRAINT "inventory_items_status_valid" CHECK("inventory_items"."status" in ('EQUIPPED', 'CHEST', 'SITUATIONAL', 'PERSONAL_STORY', 'SOLD', 'UNKNOWN')),
	CONSTRAINT "inventory_items_quantity_positive" CHECK("inventory_items"."quantity" > 0),
	CONSTRAINT "inventory_items_obtained_at_valid" CHECK("inventory_items"."obtained_at" is null or length("inventory_items"."obtained_at") = 24 and "inventory_items"."obtained_at" glob '????-??-??T??:??:??.???Z')
);
--> statement-breakpoint
CREATE INDEX `inventory_items_definition_idx` ON `inventory_items` (`item_definition_id`);--> statement-breakpoint
CREATE INDEX `inventory_items_owner_idx` ON `inventory_items` (`owner_character_id`);--> statement-breakpoint
CREATE INDEX `inventory_items_status_idx` ON `inventory_items` (`status`);--> statement-breakpoint
CREATE TABLE `item_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name_pl` text NOT NULL,
	`normalized_name_pl` text NOT NULL,
	`name_en` text,
	`type_pl` text,
	`slot` text,
	`rarity_pl` text,
	`description_pl` text,
	`verification_status` text NOT NULL,
	`verification_confidence` real,
	`verification_source` text,
	`fingerprint` text,
	`notes` text,
	CONSTRAINT "item_definitions_required_text" CHECK(length(trim("item_definitions"."id")) > 0 and length(trim("item_definitions"."name_pl")) > 0 and length(trim("item_definitions"."normalized_name_pl")) > 0),
	CONSTRAINT "item_definitions_slot_valid" CHECK("item_definitions"."slot" is null or "item_definitions"."slot" in ('HEAD', 'CLOAK', 'BODY', 'HANDS', 'FEET', 'NECK', 'RING', 'MAIN_HAND', 'OFF_HAND', 'RANGED', 'INSTRUMENT')),
	CONSTRAINT "item_definitions_status_valid" CHECK("item_definitions"."verification_status" in ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'CONFLICT')),
	CONSTRAINT "item_definitions_confidence_valid" CHECK("item_definitions"."verification_confidence" is null or "item_definitions"."verification_confidence" between 0 and 1),
	CONSTRAINT "item_definitions_fingerprint_valid" CHECK("item_definitions"."fingerprint" is null or length(trim("item_definitions"."fingerprint")) > 0)
);
--> statement-breakpoint
CREATE INDEX `item_definitions_normalized_name_idx` ON `item_definitions` (`normalized_name_pl`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_definitions_fingerprint_unique` ON `item_definitions` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `item_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`item_definition_id` text NOT NULL,
	`effect_type` text NOT NULL,
	`numeric_value` real,
	`dice_expression` text,
	`damage_type` text,
	`trigger` text,
	`condition_text_pl` text,
	`duration_text_pl` text,
	`description_pl` text NOT NULL,
	`verification_status` text NOT NULL,
	FOREIGN KEY (`item_definition_id`) REFERENCES `item_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_effects_required_text" CHECK(length(trim("item_effects"."id")) > 0 and length(trim("item_effects"."effect_type")) > 0 and length(trim("item_effects"."description_pl")) > 0),
	CONSTRAINT "item_effects_status_valid" CHECK("item_effects"."verification_status" in ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'CONFLICT'))
);
--> statement-breakpoint
CREATE INDEX `item_effects_definition_idx` ON `item_effects` (`item_definition_id`);--> statement-breakpoint
CREATE TABLE `permanent_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`modifier` integer NOT NULL,
	`source_name_pl` text NOT NULL,
	`source_item_definition_id` text,
	`provenance_type` text NOT NULL,
	`permanent` integer NOT NULL,
	`active` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_item_definition_id`) REFERENCES `item_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "permanent_modifiers_required_text" CHECK(length(trim("permanent_modifiers"."id")) > 0 and length(trim("permanent_modifiers"."source_name_pl")) > 0),
	CONSTRAINT "permanent_modifiers_target_valid" CHECK("permanent_modifiers"."target_type" = 'ATTRIBUTE' and "permanent_modifiers"."target_key" in ('STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA')),
	CONSTRAINT "permanent_modifiers_value_valid" CHECK("permanent_modifiers"."modifier" between -30 and 30),
	CONSTRAINT "permanent_modifiers_provenance_valid" CHECK("permanent_modifiers"."provenance_type" in ('GAME_UI', 'IMPORT', 'USER_CONFIRMED', 'SYSTEM')),
	CONSTRAINT "permanent_modifiers_booleans_valid" CHECK("permanent_modifiers"."permanent" in (0, 1) and "permanent_modifiers"."active" in (0, 1)),
	CONSTRAINT "permanent_modifiers_created_at_valid" CHECK(length("permanent_modifiers"."created_at") = 24 and "permanent_modifiers"."created_at" glob '????-??-??T??:??:??.???Z')
);
--> statement-breakpoint
CREATE INDEX `permanent_modifiers_character_idx` ON `permanent_modifiers` (`character_id`);--> statement-breakpoint
CREATE TABLE `spells` (
	`id` text PRIMARY KEY NOT NULL,
	`name_pl` text NOT NULL,
	`normalized_name_pl` text NOT NULL,
	`name_en` text,
	`level` integer NOT NULL,
	`school_pl` text,
	`description_pl` text,
	`verification_status` text NOT NULL,
	`notes` text,
	CONSTRAINT "spells_required_text" CHECK(length(trim("spells"."id")) > 0 and length(trim("spells"."name_pl")) > 0 and length(trim("spells"."normalized_name_pl")) > 0),
	CONSTRAINT "spells_level_valid" CHECK("spells"."level" between 0 and 9),
	CONSTRAINT "spells_status_valid" CHECK("spells"."verification_status" in ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'CONFLICT'))
);
--> statement-breakpoint
CREATE INDEX `spells_normalized_name_idx` ON `spells` (`normalized_name_pl`);