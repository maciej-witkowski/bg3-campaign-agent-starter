# ADR-0023: Versioned current-state JSON and XLSX exports

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

## Context and problem statement

M2 requires export back to XLSX and JSON. The legacy workbook is readable, but its
combined views omit stable IDs and several normalized relationships. Recreating it as
the only export contract would make round-trip identity ambiguous. Conversely, a raw
database dump would expose storage details, couple consumers to Drizzle migrations and
be awkward for human inspection.

M1 already provides a deterministic, versioned snapshot of current campaign state.
It intentionally excludes audit events, checkpoints and migration metadata. M2 should
reuse that semantic boundary while providing an inspectable spreadsheet projection.
Complete backup/restore and forensic-history round trips remain M15 scope.

## Decision drivers and invariants

- Export is read-only and never creates a campaign audit event.
- SQLite remains canonical; editing an export does not change state until an explicit
  future import invocation succeeds.
- Exact Polish display text, `NULL`, verification state, IDs and provenance must
  survive a current-state export/import round trip.
- Export formats need explicit names and versions.
- XLSX must be human inspectable without sacrificing a machine-readable normalized
  profile.
- User text must not accidentally become an executable spreadsheet formula.
- Private campaign data must not be committed or overwritten accidentally.

## Considered options

### Option A — One versioned current-state model with JSON and normalized XLSX encodings

Reuse the M1 snapshot collections as the semantic payload. JSON encodes them directly;
XLSX uses a manifest plus one normalized table per collection and optional derived
presentation sheets.

### Option B — Recreate only the ten-sheet legacy tracker

This is familiar but cannot represent stable IDs, separate item effects, assignment
sources, prerequisites and provenance losslessly.

### Option C — Export SQLite tables and columns verbatim

This is machine-complete, but leaks storage representation, boolean/date encodings and
migration details into a public contract.

### Option D — Export only JSON

This fails the XLSX deliverable and human-inspection goal.

### Option E — Include audit/checkpoint history and support restore in M2

This expands M2 into the M15 backup/restore contract and requires compatibility and
destructive-write decisions not yet approved.

## Proposed decision and rationale

Select Option A.

### Shared semantic export model

Capture a validated `CampaignSnapshotV1` through the read-only snapshot port and map
its 14 current-state collections to `BG3_CAMPAIGN_EXPORT_V1`. The envelope contains:

- exact format and positive version;
- source snapshot format/version and database schema version;
- UTC export timestamp;
- deterministic current-state collections in snapshot order;
- SHA-256 of the canonical current-state payload.

The digest covers the state payload, not presentation metadata. Audit events,
checkpoints and migration tables are excluded. This is a current-state exchange
format, not a backup or restore image.

### JSON encoding

JSON is UTF-8, strictly validated and deterministically serialized using the same
identity/key ordering guarantees as M1 snapshots. It preserves explicit `null`,
booleans, numbers, IDs, UTC instants and exact Polish strings. The JSON file can be
planned by the M2 importer as a versioned source profile even though the initial
one-time migration source is XLSX.

### XLSX encoding

`BG3_CAMPAIGN_XLSX_V1` contains a first `Metadane` manifest sheet followed by one
normalized data sheet per current-state collection. Stable IDs and foreign-key IDs are
present as text columns. Column names and order are fixed by the versioned profile;
unknown optional values are blank cells, while empty strings are never substituted for
required text.

The normalized sheets are the import contract. Optional presentation sheets such as a
party summary or combined equipment view are derived and explicitly marked
non-importable in the manifest. Formulas may appear only in those presentation sheets;
normalized data sheets contain values only.

Every string sourced from campaign data is written as a literal text cell, including
strings beginning with `=`, `+`, `-` or `@`. No campaign text is emitted as a formula,
hyperlink or external reference. Numeric, boolean and UTC date values use explicit
portable cell types/formats.

The workbook is generated from scratch rather than by modifying the private legacy
tracker. `exceljs` is shared with ADR-0020 for writing.

### Output policy

The export service receives explicit target paths. It writes a sibling temporary file,
closes and verifies the generated artifact, then renames atomically when supported.
Existing targets are not overwritten unless the caller explicitly opts in. Partial
files are never reported as successful exports.

JSON and XLSX can be requested independently. Exporting does not mutate SQLite and
does not create an audit event or checkpoint.

### Round-trip definition

M2 round-trip means:

1. import the legacy tracker into an empty latest-schema database;
2. export current state to JSON and XLSX;
3. import each format into a separate empty latest-schema database;
4. compare the canonical current-state snapshot collections and stable IDs, ignoring
   export timestamps and import audit history.

The compared state must be identical. Byte-identical workbook output is not required,
but deterministic sheet/row ordering is required for reviewable diffs.

## Boundaries and dependency direction

- The export application service depends only on validated read/snapshot ports.
- JSON and XLSX serializers are outbound adapters; they do not receive mutation
  repositories or the native database connection.
- Presentation-sheet builders depend on the shared export model, not directly on
  SQLite.
- The corresponding import profile passes through ADR-0021 planning and ADR-0022
  mutation; an edited export is never applied directly.
- No CLI, desktop UI, AI provider or external research integration is introduced.

## Data, migration and compatibility impact

- No database migration is proposed.
- Export does not modify the source tracker or canonical database.
- Stable database IDs are part of the versioned M2 exchange profile so a fresh
  round-trip can preserve relationships exactly.
- Future added fields/collections require a new export version or an explicitly
  backward-compatible optional-field rule. Unknown required versions fail explicitly.
- This decision does not promise restore of `change_events`, checkpoints or database
  file pragmas; those remain M15 concerns.

## Transaction, validation, audit and rollback impact

- Export captures one transactionally consistent read snapshot and validates it before
  writing files.
- It creates zero canonical writes and zero audit events.
- A serialization, filesystem or post-write verification failure leaves SQLite
  unchanged and removes only the verified temporary output owned by the operation.
- Importing an exported artifact follows ADR-0022 and therefore remains transactional,
  validated and audited.

## Security, privacy and external-data impact

- Exports contain private campaign state and are ignored by Git by default.
- No external links, macros, network fetches or executable formulas are generated from
  campaign data.
- JSON is parsed strictly and never evaluated.
- Export errors avoid embedding the full payload or private workbook rows.
- SHA-256 detects corruption but does not encrypt or authenticate an export.
- The service refuses implicit broad output directories and accidental overwrite.

## Required tests and operational evidence

- JSON preserves exact Unicode, apostrophes, nulls, booleans, signed modifiers, IDs
  and UTC instants and validates its digest/version.
- XLSX contains the exact manifest, normalized sheet set, headers, typed cells and
  deterministic primary/composite-key row order.
- Campaign strings beginning with spreadsheet control characters remain literal text
  after reopen and never become formulas or hyperlinks.
- Export from invalid state fails before file publication and causes zero database
  writes.
- Existing-target refusal and explicit-overwrite behavior are tested using isolated
  temporary paths.
- JSON and XLSX current-state round trips produce equal canonical snapshot collections
  in fresh databases.
- A second import of each exported artifact is a no-op with zero new audit events.
- Exporter tests prove audit/checkpoint/migration history is outside the current-state
  payload.
- Real-tracker acceptance verifies all four characters, 41 equipped placements and
  Lae'zel's permanent modifier after both round trips, without committing artifacts.
- Full `pnpm check`, relevant migration tests and high-severity audit pass.

## Consequences and trade-offs

- JSON is compact and lossless for machines; XLSX is normalized and inspectable for
  humans.
- The exported workbook differs from the original presentation-first tracker, but may
  add derived familiar views without making them import authority.
- Stable IDs make round trips precise and expose opaque identifiers in export files.
- Current-state export is intentionally not a full backup. Users must retain the
  SQLite database and future M15 backups for complete history.
- Literal-text protection may make values that resemble formulas look less magical in
  Excel, but avoids formula injection.

## Rejected alternatives

- A legacy-only workbook is rejected because it cannot round-trip the normalized
  model safely.
- Raw SQLite table export is rejected as an unstable persistence contract.
- Including restore-grade history is rejected as later-milestone scope.
- Writing into the original tracker is rejected because it risks overwriting the
  migration source and reviving XLSX as canonical state.
- Export-time audit events are rejected because export is read-only.

## Unresolved questions

None blocking. The exact Polish labels and widths of optional presentation sheets may
be refined during implementation without changing the normalized manifest/data-sheet
contract or import authority.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-28.
- Approval scope: the complete ADR-0023 proposal without requested changes.

## Change log

- 2026-08-28 — Initial M2 proposal using the M1 current-state snapshot boundary and
  explicitly deferring complete backup/restore semantics to M15.
- 2026-08-28 — Accepted after explicit repository-owner approval.
- 2026-08-29 — Implemented strict deterministic JSON, normalized formula-safe XLSX,
  verified atomic publication and stable-ID import into empty databases. Private JSON
  and XLSX round trips matched the source database's canonical state digest.
