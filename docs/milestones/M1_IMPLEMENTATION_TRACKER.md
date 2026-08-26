# M1 Implementation Tracker

Milestone: M1 — Canonical Campaign Database
Branch: `codex/m1-canonical-database`
Started: 2026-08-26
Last updated: 2026-08-26
Overall status: In progress

## Purpose

This file is the durable handoff log for M1. Update it after every ADR session, meaningful implementation slice, validation run and commit so work can resume without reconstructing context from chat history.

## Milestone contract

- Implement only M1.
- SQLite is the only writable canonical state store.
- All writes use typed domain services and one transaction.
- Validation and append-only audit insertion happen before commit.
- Invalid state and audit failures roll back completely.
- Checkpoints and snapshots remain primitives; restore/undo policy is deferred.
- Do not import or modify the real campaign tracker.
- Do not begin M2.

## Approved decisions

| ADR | Decision | Approval | Implementation status |
| --- | --- | --- | --- |
| ADR-0012 | `better-sqlite3`, Drizzle, committed SQL migrations, explicit connection factory | Accepted by repository owner, 2026-08-26 | Committed: `892ee35` |
| ADR-0013 | Normalized M1 relational model with explicit equipment relation | Accepted by repository owner, 2026-08-26 | Committed: `dd1d5bb` |
| ADR-0014 | Mandatory transaction coordinator, in-transaction validation and append-only audit | Accepted by repository owner, 2026-08-26 | Committed: `ca372dd` |
| ADR-0015 | Deterministic versioned JSON snapshots and SQLite checkpoints | Accepted by repository owner, 2026-08-26 | Committed: `d89aee8` |
| ADR-0016 | Allow lifecycle script only for pinned `better-sqlite3` | Proposed after reproducible Linux CI failures, 2026-08-26 | Awaiting explicit approval; no implementation |

## Session ledger

### Session ADR-0012 — persistence and migrations

Status: Complete — committed as `892ee35`

Implemented:

- pinned `drizzle-orm@0.45.2`, `better-sqlite3@13.0.3`, `drizzle-kit@0.31.10` and `@types/better-sqlite3@9.6.0`;
- configured Drizzle Kit for SQLite generation into committed `drizzle/` migrations, using a safe in-memory tool credential;
- added an explicit filename-only connection factory, idempotent close, foreign keys, 5,000 ms busy timeout, and file-backed-only WAL plus `synchronous=FULL`;
- added an explicit embedded migrator that closes failed initialization connections;
- added isolated file-backed/in-memory test harnesses covering pragmas, lifecycle, empty migration, idempotent reapplication and transactional migration failure;
- expanded private ignore rules for `.db`, `.sqlite` and `.sqlite3` journals and sidecars;
- explicitly denied dependency build scripts in `pnpm-workspace.yaml`; selected packages load from supplied platform artifacts in the validated Windows environment.

Files created:

- `drizzle.config.ts`
- `pnpm-workspace.yaml`
- `src/persistence/sqlite/connection.ts`
- `src/persistence/sqlite/migrations.ts`
- `src/persistence/sqlite/schema.ts` (empty ADR-0013 integration point only)
- `tests/unit/persistence/migration-fixture.ts`
- `tests/unit/persistence/sqlite-connection.test.ts`
- `tests/unit/persistence/sqlite-migrations.test.ts`

Files modified:

- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `docs/adr/0012-sqlite-drizzle-persistence-and-migrations.md`
- `src/persistence/sqlite/schema.ts`
- `docs/DATA_MODEL.md`
- `docs/adr/0013-m1-relational-state-model.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

Handoff: Main agent reviews and commits this session. ADR-0013 starts by replacing the empty `schema.ts` integration point with the complete approved M1 schema, then runs `pnpm db:generate` exactly once to create the initial committed migration. Do not use `drizzle-kit push` and do not hand-write the initial migration.

### Session ADR-0013 — relational state model

Status: Complete — committed as `dd1d5bb`

Implemented:

- independent domain entities and literal value sets for every M1 relation;
- 16-table Drizzle schema with explicit equipment and local FK/PK/UNIQUE/CHECK facts;
- final clean generated migration `0000_chief_cassandra_nova.sql` and Drizzle metadata;
- persistence-independent read contract and SQLite mapping of ISO instants to `Date`;
- empty-to-latest, exact scope, constraints and all-relation round-trip tests;
- exact physical `docs/DATA_MODEL.md` documentation.

Generation incident:

- the first untracked output exposed `?` parameters in enum `CHECK` DDL;
- the verified untracked `drizzle/` directory was deleted in full;
- enum checks now use escaped `sql.raw` literals; a final clean regeneration also
  included the reviewed self-reversal FK;
- the third and final output is generated entirely from the schema and is the only
  migration artifact that remains.

Explicitly deferred: transaction-scoped writes, `validateCampaignState()`, effective
attributes, cross-table equipment/spell validation and audit coordination (ADR-0014);
snapshot/checkpoint serialization and capture (ADR-0015).

Files created:

- `src/domain/model/campaign.ts`
- `src/domain/repositories/campaign-state-read-repository.ts`
- `src/persistence/sqlite/campaign-state-read-repository.ts`
- `drizzle/0000_chief_cassandra_nova.sql` and `drizzle/meta/*`
- `tests/unit/persistence/m1-schema.test.ts`
- `tests/unit/persistence/campaign-state-read-repository.test.ts`

Files modified:

- `src/persistence/sqlite/schema.ts`
- `docs/DATA_MODEL.md`
- `docs/adr/0013-m1-relational-state-model.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

Handoff: Main agent reviews and commits this session. ADR-0014 starts with
transaction-scoped write repositories, `validateCampaignState()`, the mandatory
coordinator and append-only audit insertion. Do not alter the initial migration or
implement ADR-0015 snapshot/checkpoint services yet.

### Session ADR-0014 — mutations, validation and audit

Status: Complete — committed as `ca372dd`

Implemented:

- stable typed validation codes/violations/error plus deterministic
  `validateCampaignState()` over transaction-scoped state;
- effective attribute derivation from base plus active permanent modifiers only;
- equipment/inventory status, owner and known-slot validation, including null owner
  for `CHEST`/`SOLD`;
- spell preparation semantics allowing not-known only when `alwaysPrepared` explicitly
  justifies availability;
- transaction-scoped typed write capabilities and typed services for character,
  modifier, definition/effect, inventory/equipment, spell, ability and illithid
  aggregates, without a generic adapter-facing patch API;
- mandatory coordinator sequence: before snapshot, typed writes, validation, after
  snapshot, exactly one audit insert and commit;
- deterministic clock/ID injection, explicit no-op result without audit, safe typed
  domain/validation/persistence errors and full rollback;
- append-only reversal representation plus forward migration guards rejecting direct
  `UPDATE`/`DELETE` of `change_events`;
- regression coverage for read-only zero writes and all required invariant, atomicity,
  rollback and audit paths.

Files created:

- `drizzle/0001_change_events_append_only.sql`;
- `src/domain/mutations/campaign-mutation.ts`;
- `src/domain/repositories/campaign-state-write-repository.ts`;
- `src/domain/services/m1-mutation-services.ts`;
- `src/domain/validation/campaign-validation.ts`;
- `src/persistence/sqlite/campaign-mutation-coordinator.ts`;
- `src/persistence/sqlite/campaign-state-write-repository.ts`;
- `src/persistence/sqlite/campaign-validation-state-reader.ts`;
- `src/persistence/sqlite/transaction-types.ts`;
- `tests/unit/domain/campaign-validation.test.ts`;
- `tests/unit/persistence/campaign-mutation-coordinator.test.ts`.

Files modified:

- `drizzle/meta/_journal.json`;
- `tests/unit/persistence/m1-schema.test.ts`;
- `docs/adr/0014-transactional-domain-mutations-and-validation.md`;
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`.
Handoff: Main agent reviews and commits this focused session. ADR-0015 must replace the
controlled snapshot port implementation used in coordinator tests with the real
deterministic `CampaignSnapshotV1` serializer/factory and add checkpoint creation.
Do not alter coordinator ordering, expose its generic callback at the package root, or
implement restore/undo/proposal/confirmation behavior.

### Session ADR-0015 — snapshots and checkpoints

Status: Complete — committed as `d89aee8`

Implemented:

- strict persistence-independent `CampaignSnapshotV1` with explicit format/version/schema/capture metadata and all 14 canonical M1 state collections;
- deterministic collection, row-identity and field ordering with exact Unicode, null, boolean and finite-number preservation;
- strict deserialization rejecting malformed/extra/missing structure, unsupported format/version, duplicate identities, non-finite numbers and non-canonical `capturedAt` values;
- exact UTF-8 SHA-256 calculation and verification after payload validation;
- real transaction-scoped SQLite snapshot adapter, now the coordinator default for before/after audit snapshots;
- typed atomic checkpoint service and repository insertion with explicit metadata, domain errors for blank label/reason and exactly-one audit behavior;
- forward migration `0002_wild_warpath` adding `snapshot_format` and `schema_version` to legacy checkpoints;
- upgrade regression from the actual `0000+0001` boundary preserving a legacy checkpoint payload, digest, related character/change event and foreign-key integrity;
- read repository and physical/logical documentation updates; no restore, undo, backup rotation or M2 behavior.

Migration generation incident and correction:

- review found that generator-friendly defaults on `snapshot_format` and `schema_version` would become unintended permanent write defaults;
- the persistent defaults were removed from the Drizzle schema and `meta/0002_snapshot.json`, and the `DEFAULT` clauses were removed from the new table DDL;
- the table-recreation `INSERT ... SELECT` was manually retained/corrected to use the explicit historical literals `BG3_CAMPAIGN_SNAPSHOT` and `schema_version=2`, because current writes must provide metadata explicitly while legacy rows still require a deterministic backfill;
- immutable migrations `0000` and `0001` were not edited; Git blob hashes remain `ca5387af1e1a8e15977538ccc107305b86fb9b6e` and `d7b512f84b74da85137a797bd8a10f3afe2eb61b`.

Files created:

- `drizzle/0002_wild_warpath.sql`
- `drizzle/meta/0002_snapshot.json`
- `src/domain/snapshots/campaign-snapshot.ts`
- `src/persistence/sqlite/campaign-snapshot.ts`
- `tests/unit/domain/campaign-snapshot.test.ts`
- `tests/unit/persistence/campaign-snapshot-checkpoint.test.ts`

Files modified:

- `drizzle/meta/_journal.json`
- `src/domain/model/campaign.ts`
- `src/domain/mutations/campaign-mutation.ts`
- `src/domain/repositories/campaign-state-write-repository.ts`
- `src/domain/services/m1-mutation-services.ts`
- `src/persistence/sqlite/campaign-mutation-coordinator.ts`
- `src/persistence/sqlite/campaign-state-write-repository.ts`
- `src/persistence/sqlite/schema.ts`
- `tests/unit/persistence/campaign-state-read-repository.test.ts`
- `tests/unit/persistence/sqlite-migrations.test.ts`
- `docs/DATA_MODEL.md`
- `docs/TESTING.md`
- `docs/adr/0015-versioned-campaign-snapshots-and-checkpoints.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

Handoff: Main agent reviews and commits this focused ADR-0015 session. Confirm the history-aware literals remain only in migration `0002`'s `INSERT ... SELECT`, while the schema/new-table DDL/metadata have no defaults. Then begin the final milestone-wide validation and delivery workflow; do not add restore/undo or start M2.

## Change inventory

### Created across M1

- ADRs `docs/adr/0012-...` through `0015-...` and this implementation tracker
- `drizzle.config.ts`, `pnpm-workspace.yaml`
- `drizzle/0000_chief_cassandra_nova.sql`
- `drizzle/0001_change_events_append_only.sql`
- `drizzle/0002_wild_warpath.sql`
- `drizzle/meta/_journal.json`, `0000_snapshot.json`, `0002_snapshot.json`
- M1 domain model, read/write repository contracts, mutation types/services, validator and snapshot primitives under `src/domain/`
- SQLite connection, migrator, schema, read/write repositories, validator reader, mutation coordinator and snapshot adapter under `src/persistence/sqlite/`
- M1 domain/persistence tests under `tests/unit/domain/` and `tests/unit/persistence/`

### Modified in ADR-0015 worktree

- `drizzle/meta/_journal.json`
- `src/domain/model/campaign.ts`
- `src/domain/mutations/campaign-mutation.ts`
- `src/domain/repositories/campaign-state-write-repository.ts`
- `src/domain/services/m1-mutation-services.ts`
- `src/persistence/sqlite/campaign-mutation-coordinator.ts`
- `src/persistence/sqlite/campaign-state-write-repository.ts`
- `src/persistence/sqlite/schema.ts`
- `tests/unit/persistence/campaign-state-read-repository.test.ts`
- `tests/unit/persistence/sqlite-migrations.test.ts`
- `docs/DATA_MODEL.md`
- `docs/TESTING.md`
- `docs/adr/0015-versioned-campaign-snapshots-and-checkpoints.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

### Created in ADR-0015 worktree

- `drizzle/0002_wild_warpath.sql`
- `drizzle/meta/0002_snapshot.json`
- `src/domain/snapshots/campaign-snapshot.ts`
- `src/persistence/sqlite/campaign-snapshot.ts`
- `tests/unit/domain/campaign-snapshot.test.ts`
- `tests/unit/persistence/campaign-snapshot-checkpoint.test.ts`

## Validation ledger

| Date | Command | Result | Scope/notes |
| --- | --- | --- | --- |
| 2026-08-26 | ADR scoped Prettier plus `git diff --check` | Passed | Proposed/accepted ADR set |
| 2026-08-26 | isolated `pnpm install --frozen-lockfile` plus `pnpm check` | Passed | ADR-0012; native SQLite loaded; 10/10 tests |
| 2026-08-26 | `pnpm db:generate` plus schema/repository scoped tests | Passed | ADR-0013; final 16-table schema and generated `0000` |
| 2026-08-26 | `pnpm check` | Passed | ADR-0013; 5 files/14 tests and build |
| 2026-08-26 | validator/coordinator/schema/migration scoped Vitest | Passed | ADR-0014; 4 files/21 tests |
| 2026-08-26 | `pnpm check` | Passed | ADR-0014; 7 files/30 tests and build |
| 2026-08-26 | snapshot/checkpoint/migration scoped Prettier and `pnpm typecheck` | Passed | ADR-0015 corrected code, JSON and docs; SQL reviewed separately |
| 2026-08-26 | `pnpm exec vitest run tests/unit/domain/campaign-snapshot.test.ts tests/unit/persistence/campaign-snapshot-checkpoint.test.ts tests/unit/persistence/sqlite-migrations.test.ts` | Passed | ADR-0015; 3 files/23 tests including strict UTC, zero-write domain errors and real upgrade |
| 2026-08-26 | `pnpm check` | Passed | ADR-0015; Prettier, ESLint, strict typecheck, 9 files/51 tests and production build |
| 2026-08-26 | `git diff --check` | Passed | Complete ADR-0015 tracked diff; untracked files inventoried above |
| 2026-08-26 | `git diff --exit-code` and `git hash-object` for `0000`/`0001` | Passed | Immutable baseline blobs `ca5387…` and `d7b512…` match source commits |
| 2026-08-26 | ADR-0015 scope scan | Passed | No restore/undo/M2 implementation; one existing deferral comment only |
| 2026-08-26 | final `pnpm check` | Passed | 9 files/51 tests, lint, strict typecheck and production build |
| 2026-08-26 | `pnpm audit --audit-level high` | Passed | One moderate development-only advisory; zero high/critical findings |
| 2026-08-26 | isolated frozen install plus `pnpm check` | Passed | Clean copy without `node_modules`/`dist`; 9 files/51 tests and build |
| 2026-08-26 | GitHub Actions CI, push and pull-request runs | Failed | Both current-head runs: 3 non-persistence files/18 tests passed; 6 SQLite worker processes exited unexpectedly |
| 2026-08-26 | `pnpm ignored-builds` plus CI failure-pattern analysis | Blocked | Confirms `better-sqlite3` lifecycle script is explicitly denied; ADR-0016 approval required |

## Commits and remote state

- `b5cbedf` — `docs: propose M1 architecture decisions`.
- `9b90a7d` — `docs: accept M1 architecture and track delivery`.
- `892ee35` — `chore: establish M1 SQLite persistence` (ADR-0012).
- `dd1d5bb` — `feat: define M1 relational campaign state` (ADR-0013).
- `ca372dd` — `feat: enforce transactional M1 mutations` (ADR-0014).
- `d89aee8` — `feat: add M1 campaign snapshots and checkpoints` (ADR-0015 / current HEAD).
- No M1 branch push or pull request yet.

## Known risks and watch points

- `better-sqlite3` native compatibility is locally verified on Windows x64 / Node.js 24.19.0; CI must still cover the repository minimum Node.js 22.13.0 and supported runners.
- `drizzle-kit@0.31.10` brings one moderate development-only esbuild advisory; no affected development server is run, and the high-severity audit gate passes.
- Full before/after snapshots favor correctness and inspectability but can grow the local database; compression/diff formats require a future versioned ADR.
- Snapshot/checkpoint history is intentionally excluded from snapshots to prevent recursion; audit tables remain append-only outside the current-state payload.
- Restore, undo, backup rotation and snapshot compatibility upgrades remain explicitly deferred; deserialization and verification are read-only in M1.
- SQLite append-only triggers intentionally reject referential actions that would update existing audit rows; current typed M1 services expose no destructive character deletion.
- The filesystem patch helper remains unavailable due a Windows sandbox setup error; this session used explicit unified diffs with temporary recovery copies for untracked files.

## Exact resume point

PR #3 is open at `1cfa19f`; GitGuardian passed, but two Linux/Node 22.13 CI runs reproducibly failed because the accepted ADR-0012 policy denies the native `better-sqlite3` install script. ADR-0016 is Proposed and no installation-policy change has been made. Next obtain explicit repository-owner approval for ADR-0016. If approved, mark it Accepted, update ADR-0012 evidence, enable only the pinned `better-sqlite3` build, run the required clean-install/native-smoke/full gates, commit and push, then wait for CI and rerun Codex review on the new head. Do not implement before approval, do not start M2 and do not implement restore/undo.
