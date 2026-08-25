# Data Model

This document describes the intended logical schema. M1 implementation may refine column names, but must preserve semantics.

## characters

- id UUID/text primary key
- canonical_name unique stable identifier
- display_name_pl
- race_pl nullable
- class_pl
- subclass_pl nullable
- level integer
- role_summary
- active_party boolean
- notes
- created_at
- updated_at

## character_attributes

Composite uniqueness: character_id + attribute.

- character_id
- attribute enum STR/DEX/CON/INT/WIS/CHA
- base_value

Effective value is derived from base plus active permanent modifiers. Do not persist an independently editable effective value unless treated as cache with validation.

## permanent_modifiers

- id
- character_id
- target_type (`ATTRIBUTE`, future extensible)
- target_key (e.g. `STR`)
- modifier integer
- source_name_pl
- source_item_definition_id nullable
- provenance_type (`GAME_UI`, `IMPORT`, `USER_CONFIRMED`, `SYSTEM`)
- permanent boolean
- notes
- created_at

## item_definitions

Represents a game item concept, not possession.

- id
- name_pl
- normalized_name_pl
- name_en nullable
- type_pl nullable
- slot enum nullable
- rarity_pl nullable
- description_pl nullable
- verification_status
- verification_confidence nullable
- verification_source nullable
- notes

Do not force uniqueness on `name_pl` alone because BG3 may contain same/localized names with different rarity/effects. Use fingerprinting and resolver rules.

## item_effects

- id
- item_definition_id
- effect_type
- numeric_value nullable
- dice_expression nullable
- damage_type nullable
- trigger nullable
- condition_text_pl nullable
- duration_text_pl nullable
- description_pl
- verification_status

Structured fields are optional enrichment. The original Polish effect text should be retained.

## inventory_items

Represents possession.

- id
- item_definition_id
- status enum `EQUIPPED|CHEST|SITUATIONAL|PERSONAL_STORY|SOLD|UNKNOWN`
- owner_character_id nullable
- equipped_slot nullable
- quantity integer default 1
- obtained_at nullable
- obtained_location nullable
- notes

For unique-item tracking, quantity may stay 1. If duplicates are intentionally collapsed, document that policy explicitly.

## spells / character_spells

`spells`: canonical definition.

`character_spells`:
- character_id
- spell_id
- source (`CLASS`, `SPELLBOOK`, `PACT`, `DOMAIN`, `ITEM`, `INVOCATION`, etc.)
- known boolean
- prepared boolean
- always_prepared boolean
- notes

## abilities / character_abilities

Ability types:
- CANTRIP
- FEAT
- INVOCATION
- MANEUVER
- CLASS_FEATURE
- PACT
- PASSIVE

Track level acquired and source.

## illithid_powers / character_illithid_powers

`illithid_powers` contains optional prerequisite relationships.

`character_illithid_powers` records unlocked state and acquisition metadata.

## merchant_sessions / merchant_candidates

Temporary non-owned state.

A merchant candidate cannot appear in inventory until a purchase mutation is confirmed.

## proposals

Short-lived proposal state:
- id
- intent_type
- structured_payload
- human_summary_pl
- created_at
- expires_at
- status `OPEN|CONFIRMED|REJECTED|EXPIRED`

## change_events

Append-only logical audit record:
- id
- timestamp
- type
- character_id nullable
- proposal_id nullable
- summary_pl
- reason_pl nullable
- before_json
- after_json
- status `CONFIRMED|REVERTED`

## checkpoints

- id
- label
- timestamp
- snapshot_path or compressed snapshot payload
- reason
- change_event_id nullable

## item_aliases

- id
- item_definition_id
- alias_text
- language
- alias_type
- confidence
- verified_by_user boolean
- source nullable

Never automatically convert a low-confidence alias to verified.
