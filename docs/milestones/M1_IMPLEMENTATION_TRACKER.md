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
| ADR-0012 | `better-sqlite3`, Drizzle, committed SQL migrations, explicit connection factory | Accepted by repository owner, 2026-08-26 | Implemented and locally validated |
| ADR-0013 | Normalized M1 relational model with explicit equipment relation | Accepted by repository owner, 2026-08-26 | Not started |
| ADR-0014 | Mandatory transaction coordinator, in-transaction validation and append-only audit | Accepted by repository owner, 2026-08-26 | Not started |
| ADR-0015 | Deterministic versioned JSON snapshots and SQLite checkpoints | Accepted by repository owner, 2026-08-26 | Not started |

## Session ledger

### Session ADR-0012 — persistence and migrations

Status: Complete — implementation pending main-agent review and commit

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
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

Handoff: Main agent reviews and commits this session. ADR-0013 starts by replacing the empty `schema.ts` integration point with the complete approved M1 schema, then runs `pnpm db:generate` exactly once to create the initial committed migration. Do not use `drizzle-kit push` and do not hand-write the initial migration.

### Session ADR-0013 — relational state model

Status: Pending

Planned scope:

- M1 Drizzle schema and initial migration;
- domain types and persistence mappings;
- repository interfaces and implementations;
- structural, migration and repository tests;
- exact `docs/DATA_MODEL.md` update.

Handoff: Build on ADR-0012's connection/migration primitives. The initial migration is generated only after the schema is complete.

### Session ADR-0014 — mutations, validation and audit

Status: Pending

Planned scope:

- typed campaign validation errors and `validateCampaignState()`;
- transaction-scoped write repositories;
- mandatory mutation coordinator;
- typed M1 aggregate services;
- immutable change events and reversal representation;
- atomicity, rollback, invariant and audit tests.

Handoff: Build on the complete M1 schema and repositories. No proposal/confirmation workflow from M6.

### Session ADR-0015 — snapshots and checkpoints

Status: Pending

Planned scope:

- `CampaignSnapshotV1` format and strict validator;
- deterministic capture/serialization/deserialization;
- SHA-256 integrity helpers;
- checkpoint repository/service integration;
- deterministic, corruption and rollback tests.

Handoff: Reuse the mutation coordinator and state reader; do not implement restore, backup rotation or undo UI.

## Change inventory

### Created

- `drizzle.config.ts`
- `pnpm-workspace.yaml`
- `src/persistence/sqlite/connection.ts`
- `src/persistence/sqlite/migrations.ts`
- `src/persistence/sqlite/schema.ts`
- `tests/unit/persistence/migration-fixture.ts`
- `tests/unit/persistence/sqlite-connection.test.ts`
- `tests/unit/persistence/sqlite-migrations.test.ts`
- `docs/adr/0012-sqlite-drizzle-persistence-and-migrations.md`
- `docs/adr/0013-m1-relational-state-model.md`
- `docs/adr/0014-transactional-domain-mutations-and-validation.md`
- `docs/adr/0015-versioned-campaign-snapshots-and-checkpoints.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

### Modified

- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `docs/adr/0012-sqlite-drizzle-persistence-and-migrations.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`
- Approval metadata in the four M1 ADRs.

## Validation ledger

| Date | Command | Result | Scope/notes |
| --- | --- | --- | --- |
| 2026-08-26 | `pnpm exec prettier --check -- docs/adr/0012-... docs/adr/0015-...` | Passed | Proposed ADR set before approval |
| 2026-08-26 | `git diff --check` | Passed | Proposed ADR set before approval |
| 2026-08-26 | `pnpm typecheck` | Passed | Strict TypeScript validation after SQLite infrastructure |
| 2026-08-26 | `pnpm test -- tests/unit/persistence` | Passed | 3 files, 10 tests; includes connection and migration coverage |
| 2026-08-26 | `pnpm exec prettier --check -- <ADR-0012 paths>` | Passed | Scoped formatting check; `.gitignore` excluded because Prettier has no parser |
| 2026-08-26 | `pnpm lint` | Passed | Repository lint gate |
| 2026-08-26 | `pnpm test` | Passed | 3 files, 10 tests |
| 2026-08-26 | `pnpm build` | Passed | Production TypeScript build |
| 2026-08-26 | `pnpm audit --audit-level high` | Passed | No high or critical findings; one moderate development-only esbuild advisory remains |
| 2026-08-26 | `pnpm install --frozen-lockfile` plus `pnpm check` in an isolated clean copy | Passed | 153 packages; native SQLite 3.53.4 loaded; 10/10 tests and full M0 gate passed |
| 2026-08-26 | `git diff --check` | Passed | Includes tracker metadata whitespace cleanup |

## Commits and remote state

- `b5cbedf` — `docs: propose M1 architecture decisions`.
- No M1 branch push or pull request yet.

## Known risks and watch points

- `better-sqlite3` is a native dependency. Windows x64 prebuild loading is verified on Node.js 24.19.0; CI must still cover the repository minimum Node.js 22.13.0 and other supported runners.
- `drizzle-kit@0.31.10` brings one moderate development-only esbuild advisory (GHSA-67mh-4wv8-2f99); the project does not run the affected development server, and the high-severity audit gate passes.
- Status plus equipment relations intentionally duplicate a fact; validator coverage is mandatory.
- Full before/after snapshots favor correctness but can grow the database; measure, do not optimize speculatively.
- The audit write path must not be bypassable through exported repositories or database handles.
- SQLite historical tables must be excluded from recursive snapshots.
- The built-in filesystem patch helper failed with a Windows sandbox setup error; repository edits use explicit unified diffs through `git apply` until it recovers.

## Exact resume point

ADR-0012 is implemented and locally validated. Main agent: review the ADR-0012 diff, verify no M1 tables or initial migration were added, then create the focused ADR-0012 commit. Resume ADR-0013 at `src/persistence/sqlite/schema.ts`: implement the complete approved relational schema, generate the first migration with `pnpm db:generate`, and add schema/repository tests plus the exact `docs/DATA_MODEL.md` update.
