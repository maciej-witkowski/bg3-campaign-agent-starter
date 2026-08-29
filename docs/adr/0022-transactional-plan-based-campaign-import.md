# ADR-0022: Transactional plan-based campaign import

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

## Context and problem statement

Parsing a workbook is not authorization to write arbitrary rows. M2 must turn a
resolved staged model into the normalized M1 schema while preserving all M1
invariants, producing an import report, creating audit history for actual changes and
making an immediate second import a true no-op.

The write spans characters, attributes, permanent modifiers, definitions, effects,
inventory, equipment and character assignments. Applying those aggregates through
separate public mutations could expose a partially imported campaign or create a long
sequence of audit events whose intermediate snapshots are not useful campaign states.

## Decision drivers and invariants

- Every canonical write goes through a typed domain service and the M1 transaction
  coordinator.
- Validation runs after all proposed writes and before commit.
- A failed import leaves no partial rows and no audit event.
- A successful state-changing import creates exactly one root import event with
  before/after snapshots.
- An idempotent no-op creates no audit event.
- Existing facts are matched or reported; import does not update or delete them.
- Conflicts are visible and cannot be silently bypassed by importing unrelated rows.
- Reports must distinguish `inserted`, `matched`, `skipped`, `ambiguous` and
  `conflicts` with stable source locations.

## Considered options

### Option A — Read-only plan followed by one typed aggregate transaction

Build a deterministic plan first. If it is applicable, insert the complete plan in one
M1-coordinated transaction, validate once and append one import audit event.

### Option B — One transaction and audit event per worksheet row

This provides granular history, but creates valid-looking partial states and hundreds
of events for a single migration intent.

### Option C — Direct repository bulk upserts

This is convenient, but bypasses typed domain meaning, can overwrite canonical facts
and risks escaping validation/audit rules.

### Option D — Replace the database from a generated snapshot

This resembles restore, which is outside M2, and would be destructive for an existing
canonical database.

### Option E — Import only into a fresh empty database

This simplifies matching, but fails idempotent re-import and cannot safely diagnose an
already initialized campaign.

## Proposed decision and rationale

Select Option A.

Introduce a typed `CampaignImportService` (name may be refined) with two explicit
operations:

- `planImport(request)` is read-only and returns a deterministic report plus a typed,
  opaque plan token/value suitable for the same process;
- `applyImport(plan)` revalidates the source digest and relevant database preconditions
  before applying the plan through the M1 coordinator.

There is no public generic row-write or callback API. The import plan enumerates only
the approved M2 insert operations and their dependencies.

### Plan order and dependency closure

The planner resolves records in dependency order:

1. characters and base attributes;
2. item/spell/ability/illithid definitions and item effects;
3. permanent modifiers;
4. inventory instances;
5. equipment assignments;
6. character spell, ability and illithid assignments and power prerequisites.

An ambiguous record is excluded together with records that depend on it. Those rows
remain `ambiguous`/`skipped` in the report. Unknown optional facts such as item effect
text are not ambiguity: the known entity can be inserted with `NULL` and
`UNVERIFIED` values.

Any structural or semantic `conflict` blocks application of the entire plan. Examples
include disagreement between the two equipped-item views, an existing identity with
incompatible facts, duplicate occupancy, stale reconciliation, and derived Strength
that disagrees with base plus modifier. The caller still receives the complete
read-only report.

### Insert-only application

The importer may:

- insert an absent canonical row;
- recognize an exact row/relationship as matched;
- omit a deliberately non-canonical or unresolved row with an explicit reason.

It may not update, delete, merge by overwriting, move equipment, clear a value or
change an existing verification status. Such differences are conflicts to reconcile
outside this import. Later ordinary campaign changes use their own typed services.

All insert IDs and timestamps come from injected deterministic providers in tests.
Production IDs may be allocated by the application, while the plan carries stable
source keys so report ordering never depends on UUID order.

### Atomic mutation and audit

For a state-changing plan, one call to the existing `CampaignMutationCoordinator`
captures the before snapshot, applies all typed inserts, validates the complete
uncommitted state, captures the after snapshot and appends one immutable
`CAMPAIGN_IMPORTED` event before commit.

The event records a bounded Polish summary, source profile, workbook SHA-256 and the
five category counts in structured operation metadata where the existing model
supports it and otherwise in a deterministic reason payload. It does not store the
workbook bytes or full report. A report file is not canonical audit history.

If the plan contains zero inserts, `applyImport` returns `changed: false`; it performs
no writes and creates no event. This is the required second-import behavior.

### Import report

Both planning and application return a versioned `BG3_IMPORT_REPORT_V1` value. Each
entry contains:

- category: `inserted`, `matched`, `skipped`, `ambiguous` or `conflicts`;
- stable entity kind and source locator;
- stable reason code and concise Polish explanation;
- source key and, when safe and applicable, canonical entity ID;
- dependency/candidate references needed to understand ambiguity;
- whether the issue blocks apply.

Entries have deterministic category/entity/source ordering. The persisted JSON report
is written atomically only to an explicitly supplied output path. A failed report-file
write cannot roll back an already committed SQLite transaction, so the service returns
the in-memory report and commit result independently and surfaces the artifact failure
clearly. The application must not claim that a report file exists when it does not.

## Boundaries and dependency direction

- Workbook adapters and normalization are read-only upstream components.
- The planner depends on read repository ports and pure comparison logic.
- `CampaignImportService` is a typed domain/application mutation boundary.
- Transaction-scoped repositories remain internal to the coordinator callback.
- The service reuses `validateCampaignState()` and snapshot/audit primitives from M1;
  it does not expose Drizzle, native SQLite or arbitrary SQL.
- Future CLI/UI adapters may select files and display reports, but cannot apply plan
  rows directly.

## Data, migration and compatibility impact

- No schema migration or new canonical import table is proposed.
- Import uses existing M1 tables, fingerprints, provenance fields, snapshots and
  append-only events.
- The source workbook remains unchanged and is not canonical after migration.
- Because import is insert-only, an older tracker cannot revert later campaign state.
- Plan/report/reconciliation JSON formats are versioned application artifacts, not
  database schema versions.

## Transaction, validation, audit and rollback impact

- One logical import is one SQLite transaction and at most one root audit event.
- Database constraints and `validateCampaignState()` see the full proposed aggregate.
- Domain, persistence, validation, snapshot or audit failure rolls back every inserted
  row and the event.
- A conflict blocks the transaction before it begins.
- An ambiguity may omit only its closed dependency subgraph; no dangling relationship
  is planned.
- A no-op second import creates zero state and audit writes.
- Report/reconciliation artifact output occurs outside canonical transaction semantics
  and is explicitly reported as such.

## Security, privacy and external-data impact

- Reports, plans, reconciliation files, exported databases and source digests are
  private campaign artifacts and ignored by Git.
- Reports do not include full before/after snapshots or SQL.
- Output paths are explicit; the service does not derive executable paths from cell
  content.
- Atomic report writes use a sibling temporary file and rename, refuse accidental
  overwrite unless explicitly allowed, and clean up only their verified temporary
  target.
- No network or model call occurs.

## Required tests and operational evidence

- Import a sanitized representative workbook into an empty migrated database and
  assert all planned aggregates.
- Import the same workbook twice and compare canonical snapshots byte-for-byte while
  asserting zero new state rows and zero new audit events on the second call.
- Assert one audit event with correct before/after state and source digest for the
  first state-changing import.
- Inject failures at definition, inventory, equipment, validation, snapshot and audit
  stages; each leaves the exact before state and event count.
- Prove an existing incompatible fact blocks the whole apply and remains unchanged.
- Prove an ambiguous independent row and its dependency closure are omitted and
  reported without creating dangling rows.
- Assert stable report categories, reason codes, source locators, ordering and counts.
- Assert legacy dashboard, prompt/rules and historical log entries are reported as
  skipped, not silently discarded or imported.
- Against the private real tracker, assert all four active characters and all 41
  equipped rows are represented, Lae'zel's modifier is correct and every unresolved
  field appears in the report/reconciliation output.
- Run full `pnpm check`, migration tests and scenario regression proving import failure
  cannot partially mutate campaign state.

## Consequences and trade-offs

- The canonical database never exposes a half-imported state.
- A single audit event accurately represents the one-time migration intent, at the
  cost of row-level details living in the report rather than separate events.
- Insert-only behavior is deliberately conservative and may require reconciliation
  when importing into a non-empty database.
- Blocking all application on a true conflict favors correctness over partial
  convenience.
- Reports remain available even when no canonical write occurs, but their file
  durability is not falsely coupled to SQLite atomicity.

## Rejected alternatives

- Per-row transactions are rejected because intermediate states and partial success
  weaken campaign correctness.
- Generic bulk upserts are rejected because they can overwrite newer canonical facts
  and bypass typed services.
- Snapshot replacement is rejected as an unapproved restore workflow.
- Auditing a no-op is rejected because it would make repeated imports look like state
  changes.
- Storing report files inside SQLite is rejected because they are diagnostic artifacts,
  not canonical campaign truth.

## Unresolved questions

None blocking. If implementation shows that existing audit columns cannot hold the
bounded source metadata without ambiguous free text, a new schema/provenance ADR and
explicit approval are required before adding a migration.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-28.
- Approval scope: the complete ADR-0022 proposal without requested changes.

## Change log

- 2026-08-28 — Initial M2 proposal aligned with the M1 coordinator, validation,
  append-only audit and no-op guarantees.
- 2026-08-28 — Accepted after explicit repository-owner approval.
- 2026-08-29 — Implemented one-transaction application, stale-plan rejection,
  validation/audit rollback and no-op re-import; the real tracker produced one audit
  event and an unchanged second import.
- 2026-08-29 — Moved the final state-digest precondition into the mutation transaction
  so no concurrent state change can occur between the freshness check and imported
  writes.
- 2026-08-29 — Authenticated in-memory plans by service instance and operation digest;
  copied or modified structural plan objects are rejected before any write.
