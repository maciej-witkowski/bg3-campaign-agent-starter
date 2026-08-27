# Data Model

This document records the physical M1 SQLite model implemented by migration
`0000_chief_cassandra_nova`. SQLite is the only writable canonical store. All
application-generated IDs are non-empty `TEXT` UUID-compatible identifiers and all
instants are UTC ISO-8601 `TEXT` in the form `YYYY-MM-DDTHH:mm:ss.sssZ`.

Unknown optional facts are stored as `NULL`. Required human text is constrained to
trimmed non-empty content. Polish display text is preserved exactly; normalized Polish
text is only a matching aid.

## Shared value sets

- attributes: `STR|DEX|CON|INT|WIS|CHA`;
- verification: `UNKNOWN|UNVERIFIED|VERIFIED|CONFLICT`;
- inventory status: `EQUIPPED|CHEST|SITUATIONAL|PERSONAL_STORY|SOLD|UNKNOWN`;
- provenance: `GAME_UI|IMPORT|USER_CONFIRMED|SYSTEM`;
- item slot type: `HEAD|CLOAK|BODY|HANDS|FEET|NECK|RING|MAIN_HAND|OFF_HAND|RANGED|INSTRUMENT`;
- equipment position: `HEAD|CLOAK|BODY|HANDS|FEET|NECK|RING_1|RING_2|MAIN_HAND|OFF_HAND|RANGED_MAIN_HAND|RANGED_OFF_HAND|INSTRUMENT`;
- spell source: `CLASS|SPELLBOOK|PACT|DOMAIN|ITEM|INVOCATION|RACE|FEAT|OTHER`;
- ability type: `CANTRIP|FEAT|INVOCATION|MANEUVER|CLASS_FEATURE|PACT|PASSIVE`.

Booleans are constrained SQLite integers `0|1`. Definition slot type and occupied
equipment position are intentionally separate: for example a ring definition has
`RING`, while a concrete assignment occupies `RING_1` or `RING_2`.

## Tables

### characters

Columns: `id` PK, `canonical_name` unique, `display_name_pl`, nullable
`race_pl`, `class_pl`, nullable `subclass_pl`, `level`, `role_summary`,
`active_party`, nullable `notes`, `created_at`, `updated_at`.

Level is constrained to 1–20. Canonical identity is unique, while display text is not
used as an identity key.

### character_attributes

Columns: `character_id` FK → characters (cascade), `attribute`, `base_value`.
Primary key: `(character_id, attribute)`. Base values use a broad corruption guard
of 1–30.

There is no persisted effective value. It is derived as base value plus active
permanent modifiers.

### permanent_modifiers

Columns: `id` PK, `character_id` FK → characters (cascade), `target_type`
(currently only `ATTRIBUTE`), `target_key`, signed `modifier`,
`source_name_pl`, nullable `source_item_definition_id` FK → item_definitions
(restrict), `provenance_type`, `permanent`, `active`, nullable `notes`,
`created_at`.

Modifier values use a broad −30…30 corruption guard. Source name and provenance are
mandatory and non-empty. The character lookup is indexed.

### item_definitions

Columns: `id` PK, `name_pl`, `normalized_name_pl`, nullable `name_en`,
`type_pl`, `slot`, `rarity_pl`, `description_pl`, `verification_status`,
`verification_confidence`, `verification_source`, `fingerprint`, `notes`.

`name_pl` is deliberately not unique. Normalized name is indexed. A non-null
fingerprint is unique, but M1 does not define or populate fingerprinting policy.
Confidence is nullable and otherwise constrained to 0–1.

### item_effects

Columns: `id` PK, `item_definition_id` FK → item_definitions (cascade),
`effect_type`, nullable `numeric_value`, `dice_expression`, `damage_type`,
`trigger`, `condition_text_pl`, `duration_text_pl`, required
`description_pl`, and `verification_status`.

The definition lookup is indexed. Structured fields enrich but never replace original
Polish effect text.

### inventory_items

Columns: `id` PK, `item_definition_id` FK → item_definitions (restrict),
`status`, nullable `owner_character_id` FK → characters (restrict), positive
`quantity` defaulting to 1, nullable `obtained_at`, `obtained_location`, and
`notes`.

Quantity must be positive for every row. An `EQUIPPED` row additionally has quantity
exactly 1; stacked rows must remain non-equipped until an explicit future operation
splits them without losing identity or provenance.

Definition, owner and status are indexed. Equipment slot is not stored here.

### equipment

Columns: `inventory_item_id` PK/FK → inventory_items (cascade), `character_id`
FK → characters (cascade), and `slot`.

The inventory-item primary key ensures one instance can occupy only one position.
Unique `(character_id, slot)` ensures one item per character position. Agreement
with inventory status/owner and definition slot type is a cross-table semantic rule
owned by `validateCampaignState()` in ADR-0014.

### spells and character_spells

`spells` columns: `id` PK, `name_pl`, `normalized_name_pl`, nullable
`name_en`, level 0–9, nullable `school_pl`, `description_pl`,
`verification_status`, and `notes`. Normalized name is indexed and not unique.

`character_spells` columns: `character_id` FK → characters, `spell_id` FK →
spells, `source`, `known`, `prepared`, `always_prepared`, nullable `notes`.
Primary key: `(character_id, spell_id, source)`. Semantic flag combinations are
validated in ADR-0014 rather than guessed by the database.

### abilities and character_abilities

`abilities` columns: `id` PK, `name_pl`, `normalized_name_pl`, nullable
`name_en`, `type`, nullable `description_pl`, `verification_status`, and
`notes`. Normalized name is indexed and not unique.

`character_abilities` columns: `character_id` FK → characters, `ability_id` FK
→ abilities, required free-text `source`, nullable `level_acquired` (1–20), and
nullable `notes`. Primary key: `(character_id, ability_id, source)`.

### illithid_powers and assignments

`illithid_powers` columns: `id` PK, `name_pl`, `normalized_name_pl`,
nullable `name_en`, `tier` (nullable, otherwise 1–10), nullable
`description_pl`, `verification_status`, and `notes`.

`illithid_power_prerequisites` is a many-to-many self-relation with primary key
`(power_id, prerequisite_power_id)`, cascading FKs, and a no-self-prerequisite
check.

`character_illithid_powers` has primary key `(character_id, power_id)`, cascading
FKs, nullable `acquired_at`, `acquisition_source_pl`, and `notes`. Missing
acquisition metadata remains unknown; prerequisites are not inferred.

### change_events

Columns: `id` PK, `occurred_at`, required `type`, nullable `character_id` FK
→ characters (set null), nullable external `proposal_id`, `summary_pl`, nullable
`reason_pl`, valid JSON `before_json` and `after_json`, and nullable
`reverses_change_event_id`.

Occurrence time and character are indexed. A unique non-null reversal reference
allows at most one direct reversal event and cannot reference the same ID. Existing
audit rows are never updated to represent reversal. Append-only write enforcement and
the audit protocol belong to ADR-0014.

### checkpoints

Columns: `id` PK, `label`, `created_at`, required non-empty `snapshot_format`,
positive `snapshot_version`, positive `schema_version`, valid JSON `snapshot_json`,
lowercase 64-character hexadecimal `snapshot_sha256`, `reason_pl`, and nullable
`change_event_id` FK → change_events (set null).

Creation time is indexed. Snapshot format and schema version have no persistent SQL
defaults: every new checkpoint write supplies the metadata captured from its validated
snapshot. Migration `0002_wild_warpath` upgrades legacy rows using the explicit format
literal `BG3_CAMPAIGN_SNAPSHOT` and historical `schema_version=2`, while preserving the
payload, digest and relation to `change_events`.

ADR-0015 implements deterministic `CampaignSnapshotV1` capture, strict canonical UTC
metadata validation, SHA-256 integrity verification and atomic checkpoint creation.
Snapshots contain current canonical campaign tables and deliberately exclude
`change_events`, `checkpoints` and Drizzle migration history.

## Persistence boundary

Domain entities in `src/domain/model/campaign.ts` do not depend on Drizzle. The M1
SQLite read repository maps persisted ISO strings to `Date` and preserves nullable
values unchanged. Transaction-scoped write repositories, mutation coordination,
campaign validation and audit insertion are introduced only by ADR-0014.

## Deferred schema

M1 intentionally has no merchant session/candidate, proposal, item alias, import,
research or other M2+ workflow tables. The real campaign spreadsheet is not read or
modified by this migration. Future physical changes require forward migrations and
corresponding updates to this document.
