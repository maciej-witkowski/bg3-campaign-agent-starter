# ADR-0026: M3 read-only SQLite CLI boundary

Status: Accepted

Milestone: M3 — Read-Only CLI

## Context and problem statement

M3 must expose local inspection commands without AI and must prove that every command
is read-only with respect to canonical campaign state. The existing M2 composition root
cannot be reused unchanged: `openM2CampaignApplication()` opens a writable connection,
applies pending migrations and exposes import services. Even a CLI handler that calls
only query methods would therefore have a write-capable dependency graph and could
change migration metadata while opening the database.

The `export` command is the one documented exception to a completely read-only process,
but its permitted write is an explicit JSON or XLSX artifact. It must not write to the
canonical SQLite database or create an audit event.

## Decision drivers and invariants

- SQLite remains the only writable canonical source of campaign truth.
- M3 must not add a second canonical store or mutate campaign rows, audit history,
  checkpoints or migration metadata.
- The CLI must fail explicitly when the database is missing, stale, newer than the
  supported schema or structurally invalid.
- CLI adapters must not receive a native SQLite handle, Drizzle database, mutation
  repository, migration runner or M1/M2 mutation service.
- Validation and export must observe one transactionally consistent state.
- Export must reuse the approved M2 current-state contract and atomic artifact policy.
- M3 must not add a schema migration or pre-implement M4 typed tools.

## Considered options

### Option A — Dedicated read-only connection and M3 query composition root

Open an existing database in SQLite read-only mode, enable connection-level query-only
defence, verify schema compatibility without applying migrations and inject only typed
query, validation and export read capabilities into the CLI.

### Option B — Reuse the writable M2 composition root and rely on handler discipline

This minimizes composition code, but opening the application may apply migrations and
the object graph contains mutation services. Read-only behavior would be a convention,
not an enforced capability boundary.

### Option C — Copy the database to a temporary file before every query

This isolates the source, but introduces stale reads, extra private artifacts and
failure modes around copying WAL databases. It is unnecessary when SQLite can enforce
read-only access directly.

### Option D — Query a JSON/XLSX export instead of SQLite

This makes an export a second, potentially stale source of truth and violates the
requirement to inspect canonical state.

### Option E — Keep the status quo and defer the CLI

The current package has no M3 command entry point and cannot meet the milestone.

## Proposed decision and rationale

Select Option A.

Introduce a dedicated M3 composition root that accepts an explicit existing database
path and returns only:

- a typed campaign inspection/query service;
- a typed campaign validation service;
- the existing M2 `CampaignExportService`, wired only to its read source;
- an idempotent `close()` operation.

The connection factory used by this composition root will:

1. refuse an empty path, the in-memory sentinel and a missing file;
2. open SQLite with the driver's read-only and file-must-exist behavior;
3. enable `PRAGMA query_only = ON` as defence in depth;
4. avoid write-affecting setup such as WAL selection and avoid invoking the migration
   runner;
5. inspect the Drizzle migration ledger and required schema objects without changing
   them;
6. accept exactly the latest schema version supported by this build and return a typed
   compatibility error for missing, older or newer schemas;
7. close the connection on setup failure and after command completion.

The exact latest migration count/hash information is derived from the committed
migration bundle rather than silently upgrading the user's database. Schema upgrade is
an explicit operational step outside M3 inspection commands.

Read commands execute through typed application/query ports. Their persistence adapter
may use purpose-built joined projections, but raw SQL/Drizzle and persistence row types
do not cross into the CLI adapter. The M3 composition root does not instantiate or
export `CampaignMutationCoordinator`, import services or write repositories.

`validate` uses the existing deterministic `validateCampaignState()` against a
read-only state reader. It reports violations and never repairs them.

`export` captures and validates one consistent read transaction through the existing
M2 export source and serializer. The only write capability supplied for that command is
the approved atomic artifact writer. An explicit target path is required; existing
targets are refused unless the caller supplies the explicit overwrite option. Export
creates no checkpoint or audit event and never modifies SQLite.

## Boundaries and dependency direction

The M3 dependency direction is:

`CLI process adapter -> M3 application query/validation contracts -> read ports -> SQLite`

For export it is:

`CLI process adapter -> M2 CampaignExportService -> validated snapshot read port -> SQLite`

and separately:

`CampaignExportService -> JSON/XLSX serializer -> atomic artifact writer`

The CLI process adapter owns argument translation, rendering and exit status only. The
application layer owns query semantics and DTO assembly. Persistence owns joins and
schema inspection. No M3 module depends on the future model, tool registry, research,
voice or desktop layers.

## Data, migration and compatibility impact

- No database schema or migration change is proposed.
- No existing campaign row is rewritten or backfilled.
- A missing or incompatible schema is an error; M3 never auto-migrates it.
- The public M2 JSON/XLSX export formats remain unchanged and are reused rather than
  forked into a CLI-specific export format.
- CLI query DTOs and their versioning are governed by ADR-0028; they are not database
  dump formats and do not become writable import authority.

## Transaction, validation, audit and rollback impact

- Read queries and validation perform no mutation, so they create no audit event and
  require no state rollback path.
- Multi-query views that must be internally consistent are assembled inside one
  read transaction.
- `validate` returns all deterministic violations; it does not invoke the mutation
  coordinator or write a failed-attempt event.
- Export artifact publication retains M2's temporary-write, verification and atomic
  publication behavior. Artifact failure removes the temporary file when possible and
  leaves the source database untouched.
- Overwriting an explicitly named export is an external artifact operation, never a
  campaign-state rollback or restore operation.

## Security, privacy and external-data impact

- Read-only plus query-only SQLite access limits damage from implementation mistakes.
- Database and export paths are local explicit inputs; M3 performs no network access.
- Raw SQL, stack traces and full private state are not printed in normal error output.
- Export artifacts contain private campaign state and remain subject to existing ignore
  rules and ADR-0010.
- The CLI does not accept SQL fragments, table names or arbitrary projection strings.
- SQLite files, WAL/SHM companions and generated exports are never added to source
  control by the command itself.

## Required tests and operational evidence

- Integration tests run every non-export command against a sanitized file database and
  prove identical canonical snapshot digest and `change_events` contents before and
  after execution.
- File-level evidence records the database and existing WAL/SHM bytes or hashes before
  and after representative command runs; platform-created transient files are handled
  explicitly and must contain no canonical mutation.
- A deliberately write-attempting test through the read-only connection fails.
- Missing, empty, in-memory, old, incomplete and newer schema inputs fail without being
  created or migrated.
- Tests prove the public M3 composition type exposes no import service, mutation
  coordinator, native connection or write repository.
- Concurrent-read/consistent-snapshot tests cover compound character/equipment views.
- `validate` reports a sanitized corrupt-state fixture without changing it.
- JSON and XLSX export tests prove zero SQLite/audit writes, explicit-target behavior,
  no implicit overwrite and cleanup after publication failure.
- The production CLI is exercised as a child process, not only by direct function calls.

## Implementation evidence

- `openReadOnlySqliteConnection()` requires an existing file, rejects the in-memory
  sentinel, opens `better-sqlite3` with `readonly` and `fileMustExist`, enables
  connection-local `query_only`, foreign keys and the bounded busy timeout, and never
  selects WAL or invokes the migrator.
- `assertLatestCampaignSchema()` reads the committed migration bundle, compares every
  applied migration hash and timestamp in order, rejects missing/older/newer/mismatched
  ledgers and verifies all 16 canonical M1 tables without writing metadata.
- `CampaignValidationService` is a read-only application boundary around the existing
  deterministic validator and returns violations without repair.
- Focused tests prove missing files are not created, a direct insert is refused, database
  bytes remain unchanged, old schemas are not upgraded, newer/tampered histories and
  missing tables are rejected, and validation leaves its source unchanged.
- Final M3 composition wiring, consistent compound query transactions and export
  exposure are completed with the ADR-0027 inspection service because the composition
  must expose that concrete typed service rather than a raw or generic database hook.

## Consequences and trade-offs

- Capability separation makes the no-write promise enforceable and reviewable.
- A separate connection and composition root add a small amount of persistence wiring.
- Refusing to auto-migrate makes inspection safer, but users must run a distinct future
  migration/operational command when the schema is stale.
- Exact schema compatibility rejects forward-compatible-looking databases rather than
  risking incorrect interpretation of private campaign state.
- Reusing the M2 exporter avoids a competing artifact contract.

## Rejected alternatives

- A writable connection guarded only by code review is rejected because it can migrate
  or mutate state before a handler runs.
- Exposing Drizzle to the adapter is rejected as an arbitrary-query/write escape hatch.
- Automatic migration during any M3 command is rejected because it is a canonical-state
  write outside the milestone's explicit export exception.
- Database copying is rejected because it complicates WAL consistency and private-file
  lifecycle without improving on enforced read-only access.
- Export-time audit events and checkpoints are rejected because export is not a campaign
  mutation.

## Unresolved questions

None blocking. Platform-specific WAL/SHM behavior will be captured as implementation
evidence; any inability to enforce a non-writing connection on a supported platform
requires a new proposed ADR rather than weakening the tests.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-30.
- Approval scope: the complete ADR-0026 proposal without requested changes.

## Change log

- 2026-08-30 — Initial M3 proposal.
- 2026-08-30 — Accepted after explicit repository-owner approval.
- 2026-08-30 — Implemented and tested the enforced read-only connection, exact schema
  compatibility verifier and read-only validation application boundary; recorded the
  typed composition integration point for ADR-0027.
