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
| ADR-0012 | `better-sqlite3`, Drizzle, committed SQL migrations, explicit connection factory | Accepted by repository owner, 2026-08-26 | Not started |
| ADR-0013 | Normalized M1 relational model with explicit equipment relation | Accepted by repository owner, 2026-08-26 | Not started |
| ADR-0014 | Mandatory transaction coordinator, in-transaction validation and append-only audit | Accepted by repository owner, 2026-08-26 | Not started |
| ADR-0015 | Deterministic versioned JSON snapshots and SQLite checkpoints | Accepted by repository owner, 2026-08-26 | Not started |

## Session ledger

### Session ADR-0012 — persistence and migrations

Status: Pending

Planned scope:

- exact stable dependencies and lockfile;
- Drizzle configuration;
- explicit SQLite connection lifecycle and pragmas;
- migration runner and migration test harness;
- private runtime-file ignore rules.

Handoff: Start by inspecting current package scripts, ignore rules and supported Drizzle APIs. Do not define later-milestone tables.

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

- `docs/adr/0012-sqlite-drizzle-persistence-and-migrations.md`
- `docs/adr/0013-m1-relational-state-model.md`
- `docs/adr/0014-transactional-domain-mutations-and-validation.md`
- `docs/adr/0015-versioned-campaign-snapshots-and-checkpoints.md`
- `docs/milestones/M1_IMPLEMENTATION_TRACKER.md`

### Modified

- Approval metadata in the four M1 ADRs.

## Validation ledger

| Date | Command | Result | Scope/notes |
| --- | --- | --- | --- |
| 2026-08-26 | `pnpm exec prettier --check -- docs/adr/0012-... docs/adr/0015-...` | Passed | Proposed ADR set before approval |
| 2026-08-26 | `git diff --check` | Passed | Proposed ADR set before approval |

## Commits and remote state

- `b5cbedf` — `docs: propose M1 architecture decisions`.
- No M1 branch push or pull request yet.

## Known risks and watch points

- `better-sqlite3` is a native dependency; verify frozen installation on supported Node.js and CI.
- Status plus equipment relations intentionally duplicate a fact; validator coverage is mandatory.
- Full before/after snapshots favor correctness but can grow the database; measure, do not optimize speculatively.
- The audit write path must not be bypassable through exported repositories or database handles.
- SQLite historical tables must be excluded from recursive snapshots.
- The built-in filesystem patch helper failed with a Windows sandbox setup error; repository edits use explicit unified diffs through `git apply` until it recovers.

## Exact resume point

Formal ADR approval has been recorded. Begin Session ADR-0012. After completing it, update this tracker with files, commands, results, risks and the next exact step before moving to ADR-0013.
