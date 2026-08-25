# ADR-0015: Versioned campaign snapshots and checkpoints

Status: Proposed

Milestone: M1 — Canonical Campaign Database

## Context and problem statement

M1 requires checkpoint and snapshot serialization primitives, while later milestones will add user-facing undo, backup and recovery workflows. A snapshot format must be deterministic enough for audit tests and integrity checks, but M1 must not prematurely implement restore policy or create a second writable source of truth.

The logical model permits a checkpoint path or compressed payload. Storing external snapshot files would introduce file/database consistency problems; storing opaque compressed bytes immediately would make early inspection and migration harder.

## Decision drivers and invariants

- SQLite remains the only writable canonical store.
- Change events need reliable before/after representations.
- Checkpoints are first-class private records with integrity metadata.
- Serialization must be versioned, deterministic and preserve `NULL`/unknown values and exact Polish text.
- Snapshot creation must not recursively include audit history or checkpoints.
- M1 must provide serialization/deserialization and integrity verification, not a full restore/undo product.
- A corrupted or unsupported snapshot must fail explicitly.

## Considered options

### Option A — Versioned deterministic JSON payload stored in SQLite

Canonical state tables are serialized in stable table/row/key order, stored as text with a format version and SHA-256 digest, and reused by audit and checkpoint primitives.

### Option B — Compressed binary payload stored in SQLite

This saves space but makes initial debugging and manual inspection harder and adds compression/versioning concerns before campaign size justifies them.

### Option C — External snapshot files referenced by path

This keeps the database smaller but creates atomicity, portability and orphan-file problems and risks turning the filesystem into another writable truth store.

### Option D — SQLite file copies as checkpoints

Database copies are valuable for operational backup, but they are too coarse for mutation audit snapshots and require careful online-backup semantics deferred to reliability work.

### Option E — Unversioned `JSON.stringify()` output

This is easy initially but unstable ordering and missing format metadata make digests, comparisons and evolution unreliable.

### Option F — Defer all snapshots

The status quo fails M1 and ADR-0008.

## Proposed decision and rationale

Define a `CampaignSnapshotV1` domain format and a serializer with these properties:

- a top-level format identifier and integer version;
- the schema/migration version observed when captured;
- a capture timestamp supplied by the caller;
- one collection for each canonical M1 state table;
- stable collection order, stable row order by primary key/composite key and stable object-key order;
- exact preservation of `NULL`, booleans, numbers and Unicode Polish text;
- rejection of non-finite numbers, unsupported versions, duplicate identities and structurally invalid JSON.

Snapshot state includes characters, attributes, permanent modifiers, item definitions/effects, inventory/equipment, spell/ability/illithid definitions and character assignments. It excludes `change_events`, `checkpoints` and Drizzle migration metadata. Excluding historical metadata prevents recursive growth and keeps the payload focused on reconstructable current campaign truth.

Use the same serializer for audit before/after payloads and checkpoint payloads. Store JSON as UTF-8-compatible SQLite `TEXT` together with:

- `snapshot_format` and `snapshot_version`;
- `schema_version`;
- SHA-256 digest of the exact serialized payload;
- creation timestamp;
- checkpoint label and reason;
- optional related `change_event_id`.

The digest detects corruption or accidental modification; it is not an authentication mechanism.

Checkpoint creation is a typed domain mutation and follows ADR-0014. Because historical tables are excluded from state snapshots, creating a checkpoint may have identical campaign-state before/after payloads; its audit event still records the checkpoint metadata and operation intent. A checkpoint may optionally reference the campaign change event whose post-state it captures. The checkpoint-creation event itself need not be referenced back from the checkpoint.

M1 provides:

- capture from a transaction-scoped consistent read;
- deterministic serialization;
- validated deserialization;
- digest calculation and verification;
- checkpoint persistence and retrieval primitives.

M1 does not restore a snapshot over current campaign state, schedule checkpoints, copy live database files, rotate backups or expose user-facing undo. Those behaviors require later milestone decisions and tests.

## Boundaries and dependency direction

- The snapshot format and validator are domain/application primitives independent of Drizzle row types.
- Persistence adapters read rows in a transaction and map them into the snapshot format.
- The checkpoint repository stores/retrieves the serialized envelope.
- The mutation coordinator consumes the serializer for audit before/after payloads.
- No adapter or model may write a snapshot directly into canonical state.

## Data, migration and compatibility impact

- The initial `checkpoints` table stores the payload and integrity/version metadata inside SQLite.
- `change_events` stores versioned before/after payloads using the same format.
- V1 is additive to a new empty M1 database and does not serialize/import the real tracker.
- Future snapshot formats add a new version and explicit compatibility reader; existing payloads are not rewritten silently.
- A future restore migration must validate both the snapshot format and target schema compatibility before writing.

## Transaction, validation, audit and rollback impact

- Before and after audit snapshots are captured from the same transaction as the mutation, providing consistent views.
- Campaign validation runs on live uncommitted rows before the after snapshot is accepted.
- Checkpoint insertion and its audit event commit or roll back together.
- Serialization, digest or checkpoint insertion failure rolls back the checkpoint mutation and any enclosing domain operation.
- Deserialization never mutates the database.

## Security, privacy and external-data impact

- Snapshot payloads contain private campaign state and remain inside the private SQLite database.
- Digest verification detects corruption but does not protect confidentiality or prove authorship.
- JSON is parsed as data with strict validation; it is never evaluated.
- No external storage, network transfer or cloud backup is introduced.
- Test snapshots use sanitized fictitious campaign data.

## Required tests and operational evidence

- Identical canonical state produces byte-identical JSON and digest with an injected identical timestamp.
- Different insertion/query order produces the same canonical serialization.
- Polish Unicode, `NULL`, booleans and signed numeric modifiers round-trip exactly.
- Unknown version, malformed JSON, duplicate identity, non-finite value and digest mismatch fail explicitly.
- Snapshot capture excludes audit, checkpoint and migration tables.
- Before/after audit payloads correspond to the actual transaction states.
- Checkpoint creation stores valid metadata and is audited atomically.
- Injected serialization/digest/persistence failure proves rollback.
- Deserialization and integrity verification produce zero database writes.

## Consequences and trade-offs

- Deterministic readable JSON makes audits and tests transparent.
- Full snapshots increase database size; this is acceptable for one local campaign and can be revisited with a new format/version when measured.
- Excluding audit/checkpoint history means a snapshot represents current campaign truth, not a complete forensic database clone.
- A SHA-256 digest provides integrity detection, not encryption or authenticity.
- Restore and backup remain deliberately unavailable in M1 despite the presence of deserialization primitives.

## Rejected alternatives

- External files are rejected because checkpoint/database atomicity would be harder and SQLite would no longer contain the complete writable record.
- Compression is rejected for V1 because inspectability is more valuable before storage pressure is measured.
- Raw SQLite copies are rejected as the audit snapshot format and deferred as an operational backup technique.
- Unversioned JSON is rejected because format evolution would be unsafe.
- Implementing restore, undo or rotation is rejected as later-milestone scope.

## Unresolved questions

None blocking. Compression or row-diff snapshots may be proposed later only with compatibility, migration and restore evidence.

## Approval record

Pending explicit user approval.

## Change log

- 2026-08-26 — Initial M1 proposal.
