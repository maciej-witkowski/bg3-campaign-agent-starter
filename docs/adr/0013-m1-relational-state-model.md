# ADR-0013: M1 relational campaign state model

Status: Accepted

Milestone: M1 — Canonical Campaign Database

## Context and problem statement

`docs/DATA_MODEL.md` defines the logical campaign entities, while M1 must turn the M1 subset into a relational schema that preserves unknown data, Polish canonical names, provenance and equipment consistency. The logical draft leaves several physical choices open: identifier and timestamp representation, whether equipment is a separate relation, how to represent illithid prerequisites, and how to avoid making localized display names incorrectly unique.

## Decision drivers and invariants

- Polish game names remain canonical user-facing identifiers under ADR-0002.
- Unknown values remain `NULL`; empty strings and invented defaults must not masquerade as facts.
- Item definition and item possession are distinct.
- An equipped inventory instance can occupy only one slot and cannot simultaneously be chest, sold or another status.
- Base attributes and permanent modifiers remain separate; effective attributes are derived.
- Every permanent modifier has non-empty provenance.
- Database constraints enforce local facts; cross-table campaign rules are also checked by `validateCampaignState()`.
- The schema must not pre-implement merchant, proposal, alias-resolution or import workflows from later milestones.

## Considered options

### Option A — Normalized M1 schema with explicit join and equipment tables

Definitions, ownership, assignments and equipment are separate relations. SQLite constraints protect row-local facts and the validator protects cross-table invariants.

### Option B — Put all character state into JSON documents

This reduces table count but weakens referential integrity, precise migrations, targeted queries and invariant diagnostics.

### Option C — Store equipment only as columns on inventory instances

This matches the shortest interpretation of the logical draft, but uniqueness of character-slot occupancy and one-instance/one-slot membership becomes less explicit and harder to query safely.

### Option D — Add all later-roadmap tables now

Adding merchant sessions, proposals and aliases would anticipate later behavior before its milestone contracts and ADRs are approved.

### Option E — Keep only schema notes in `DATA_MODEL.md`

The status quo cannot provide canonical persistence.

## Proposed decision and rationale

Create the following normalized M1 relations:

- `characters`;
- `character_attributes`;
- `permanent_modifiers`;
- `item_definitions` and `item_effects`;
- `inventory_items` and `equipment`;
- `spells` and `character_spells`;
- `abilities` and `character_abilities`;
- `illithid_powers`, `illithid_power_prerequisites` and `character_illithid_powers`;
- `change_events` and `checkpoints`.

Merchant sessions, merchant candidates, proposals and item aliases remain deferred to their roadmap milestones. M1 may define reusable enums/types, but it will not create dormant tables or services for those workflows.

Physical representation rules:

- Application-generated UUIDs are stored as `TEXT` primary keys. Services may allocate IDs before a transaction so related audit metadata is deterministic.
- Instants are stored as non-null UTC ISO-8601 `TEXT`; domain APIs use `Date` or an injected clock at their boundary.
- Booleans use constrained SQLite integers.
- Enumerated values use TypeScript literal unions plus SQLite `CHECK` constraints.
- Structured snapshots use versioned JSON text as specified by ADR-0015.
- Required human text is trimmed and non-empty; optional unknown facts are `NULL`, not empty placeholder strings.

Identity and naming rules:

- `characters.canonical_name` is a unique stable internal/user-facing character key and `display_name_pl` preserves display text.
- Item `name_pl` is not unique. Item definitions have an optional fingerprint field that later resolution/import logic may populate under an approved policy.
- Spell, ability and illithid definition IDs are authoritative. Their Polish display names are preserved, but M1 does not silently merge records merely because names match.
- Normalized names are matching aids only and never replace original Polish text.

Attribute and modifier rules:

- `character_attributes` is unique by character and the six-attribute key, with a valid BG3 numeric range enforced at the domain boundary and a broad corruption-prevention database check.
- No editable effective-value column exists.
- `permanent_modifiers` stores target type/key, signed modifier, source Polish name, provenance type, optional source item, notes and an active flag. M1 accepts only permanent attribute targets; the representation remains extensible without pretending later target types are implemented.
- Effective attribute value is computed as base value plus active permanent modifiers.

Inventory and equipment rules:

- Every `inventory_items` row represents possession and has exactly one constrained status plus a positive quantity.
- `equipment` relates one inventory instance to one character and one slot.
- A unique constraint on `equipment.inventory_item_id` prevents one instance occupying two slots.
- A unique constraint on `(equipment.character_id, equipment.slot)` prevents two instances occupying the same character slot.
- An equipment row must agree with `inventory_items.status = EQUIPPED`, the inventory owner and any known item-definition slot. These cross-table facts are checked by `validateCampaignState()` before commit.
- Non-equipped statuses must not have an equipment row. `CHEST` and `SOLD` have no equipped owner/slot semantics.

Spell, ability and illithid rules:

- Character join tables use composite uniqueness so the same definition/source assignment is not duplicated silently.
- Known, prepared and always-prepared spell flags retain their distinct meanings; validation rejects impossible combinations such as prepared but not known unless the recorded source semantics explicitly allow it.
- Illithid prerequisites use a many-to-many self-relation rather than a single parent column.
- Character unlock rows carry acquisition metadata without inferring prerequisite satisfaction when the fact is unknown.

Audit and checkpoint column semantics are completed by ADR-0014 and ADR-0015. In particular, reversal is represented by a new event referencing the earlier event; an existing audit row is never updated merely to change a status flag.

## Boundaries and dependency direction

- Drizzle table definitions belong to persistence.
- Domain entity/value types do not depend on Drizzle table types.
- Repositories map between persistence rows and domain values.
- Only domain services decide valid mutation semantics.
- Future adapters and tools consume domain services, never table objects.

## Data, migration and compatibility impact

- The first M1 migration creates only empty tables, indexes and constraints.
- No spreadsheet rows or real campaign data are imported in M1.
- The current logical `DATA_MODEL.md` will be updated after approval and implementation to document exact columns, constraints and the separate `equipment` relation.
- Future schema changes require forward migrations and compatibility tests.
- The initial migration is non-destructive because there is no earlier campaign schema.

## Transaction, validation, audit and rollback impact

- Foreign keys, uniqueness and `CHECK` constraints reject structurally invalid rows.
- Cross-table and semantic rules are validated inside the same write transaction by the protocol in ADR-0014.
- Failed inserts, validation or audit creation roll back the complete domain operation.
- No database trigger silently repairs or reassigns campaign state.

## Security, privacy and external-data impact

- The schema stores private local campaign state but no credentials.
- Free-text and JSON values are treated as data, never executable SQL.
- M1 uses sanitized fixtures and does not open the real XLSX tracker.
- Verification and provenance columns preserve uncertainty rather than importing external claims as truth.

## Required tests and operational evidence

- Empty-to-latest migration asserts every M1 table, foreign key, index and check constraint.
- Constraint tests cover duplicate character identity, invalid enum/boolean/quantity values and broken foreign keys.
- Repository round-trip tests cover nullable unknowns and exact Polish text preservation.
- Invariant tests cover duplicate equipment instance, duplicate occupied slot, status/equipment disagreement, owner disagreement and sold/chest equipment.
- Attribute tests cover base plus active permanent modifiers and prove no effective value is persisted independently.
- Provenance tests reject missing or blank modifier source/provenance.
- Join-table tests reject unintended duplicate assignments.
- Scope review proves no M2+ workflow table or real campaign data was added.

## Implementation evidence

- The final clean Drizzle Kit output is `drizzle/0000_chief_cassandra_nova.sql` plus its
  journal and snapshot metadata. It creates exactly the 16 approved M1 tables and no
  campaign rows or M2+ workflow tables.
- An initial generator attempt exposed parameter placeholders in enum `CHECK` DDL.
  That untracked output was discarded in full. The schema now emits escaped literal
  lists through `sql.raw`, and the final migration was regenerated cleanly rather
  than hand-edited.
- Domain entities and literal value sets live in `src/domain/model/campaign.ts`
  without importing Drizzle. The domain read contract is also persistence-agnostic.
- `SqliteCampaignStateReadRepository` maps persisted instants to `Date`, preserves
  nulls and exact Polish text, and covers every M1 relation. Transaction-scoped write
  repositories remain explicitly deferred to ADR-0014.
- Empty-to-latest tests assert the exact table set, foreign-key integrity and absence
  of merchant/proposal/alias tables. Constraint tests cover identity, enum, boolean,
  quantity, provenance, foreign-key, equipment uniqueness and join uniqueness.
- Repository round-trip coverage populates all M1 relations with sanitized fixtures
  and proves Polish diacritics, apostrophes, nullable unknowns and instants survive.
- Cross-table inventory/equipment agreement, effective attribute computation and
  spell flag semantics remain validation rules for ADR-0014; this session adds no
  mutation coordinator, campaign validator or audit-writing service.


## Consequences and trade-offs

- Explicit relations provide strong queryability and precise diagnostics at the cost of more tables and joins.
- Status plus equipment relations contain intentional redundant facts, so validation is mandatory; the redundancy makes current inventory state explicit while uniqueness makes slot occupancy safe.
- Text UUIDs and ISO timestamps are inspectable and portable but use more storage than integer/binary forms.
- Deferring later tables keeps M1 focused but means later milestones will add migrations.
- Broad database checks plus stricter typed domain validation allow future legitimate BG3 values to evolve without destructive schema rewrites.

## Rejected alternatives

- JSON aggregate storage is rejected because it weakens relational invariants and migration granularity.
- Equipment-only columns on inventory are rejected because explicit slot occupancy deserves its own constrained relation.
- Unique Polish item names are rejected because localized collisions are valid.
- Persisted effective attributes are rejected because they can drift from modifiers.
- Schema triggers that silently repair invalid ownership or status are rejected because conflicts must be surfaced.
- Later-milestone tables are rejected from M1 scope.

## Unresolved questions

None blocking. Exact broad numeric corruption bounds and the exhaustive initial slot/source enums will be documented in the implementation diff and must not encode unverified game facts.

## Approval record

- Approved by the repository owner in the Codex task on 2026-08-26.
- Approval scope: the complete ADR-0013 proposal without requested changes.

## Change log

- 2026-08-26 — Initial M1 proposal.
- 2026-08-26 — Accepted after explicit user approval.
- 2026-08-26 — Recorded the implemented schema, clean generated migration, domain/read repository boundary and validation evidence.
