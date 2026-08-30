# M3 Implementation Tracker

Milestone: M3 — Read-Only CLI
Branch: `codex/m3-read-only-cli`
Started: 2026-08-30
Last updated: 2026-08-30
Overall status: In progress

## Purpose

This is the durable handoff log for M3. Update it after every ADR session, meaningful
implementation slice, validation run and commit so work can resume without reconstructing
context from chat history.

## Milestone contract

- Implement only `party`, `character`, `equipment`, `inventory`, `spells`, `illithid`,
  `changes`, `validate` and `export`.
- All SQLite access is physically read-only; `export` may write only an explicit JSON or
  XLSX artifact.
- No automatic migration, canonical mutation, audit event or checkpoint is allowed.
- Machine output uses the versioned `BG3_CLI_RESULT` V1 envelope.
- Polish display text and explicit unknowns are preserved.
- No AI, M4 tool registry, fuzzy resolver or M14 tag taxonomy is introduced.
- Do not begin M4.

## Approved decisions

| ADR | Decision | Approval | Implementation status |
| --- | --- | --- | --- |
| ADR-0026 | Dedicated read-only SQLite connection/composition and isolated export writes | Accepted by repository owner, 2026-08-30 | Core complete; composition integration pending ADR-0027 |
| ADR-0027 | Typed command projections, deterministic resolution/filter/order semantics | Accepted by repository owner, 2026-08-30 | In progress |
| ADR-0028 | Native Node parser, explicit DB path, V1 envelope and stable exit categories | Accepted by repository owner, 2026-08-30 | Pending |

## Session ledger

### Session ADR-0026 — read-only persistence and composition

Status: Complete — pending focused commit

Implemented:

- existing-file-only SQLite read connection with `readonly`, `fileMustExist` and
  query-only defence;
- exact non-mutating migration hash/timestamp and required-table compatibility checks;
- read-only application validation service;
- focused tests proving write attempts, migration gaps and canonical file changes fail;
- ADR implementation evidence.

Validation: scoped formatting and strict typecheck passed; 3 focused files / 13 tests
passed outside the sandbox after its process-spawn restriction blocked Vitest workers.

Handoff: ADR-0027 must add the concrete typed inspection service and then close the
composition integration point with inspection, validation and M2 export only. It must
not expose the raw database or add process parsing/rendering.

### Session ADR-0027 — query semantics and projections

Status: In progress

Planned:

- typed query requests/results and safe errors;
- deterministic character resolution and all command-specific projections;
- effective attribute calculation and exact inventory facet filters;
- compound-read consistency and focused integration tests;
- implementation evidence and one focused commit.

Handoff: complete and validate this session before starting ADR-0028. Do not add process
argument parsing or output rendering here.

### Session ADR-0028 — process contract and renderers

Status: Pending

Planned:

- strict native Node argument parser and `bg3-campaign` executable;
- human Polish and `BG3_CLI_RESULT` V1 JSON renderers;
- stdout/stderr discipline and stable exit codes;
- child-process integration tests for all nine commands;
- implementation evidence and one focused commit.

Handoff: after this session, run milestone-wide documentation, validation, stabilization,
PR, CI/security and Codex review workflow. Do not start M4.

## Change inventory

### Created

- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`

### Modified

- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`

### Created in ADR-0026 session

- `src/persistence/sqlite/read-only-connection.ts`
- `src/persistence/sqlite/schema-compatibility.ts`
- `src/application/inspection/campaign-validation-service.ts`
- `tests/unit/persistence/read-only-connection.test.ts`
- `tests/unit/persistence/schema-compatibility.test.ts`
- `tests/unit/application/campaign-validation-service.test.ts`

## Validation ledger

| Date | Command | Result | Scope/notes |
| --- | --- | --- | --- |
| 2026-08-30 | ADR required-section/trailing-whitespace check | Passed | Three proposed ADRs before approval |
| 2026-08-30 | `git pull --ff-only` | Passed | `main` already current before branch creation |
| 2026-08-30 | scoped Prettier check | Blocked | Dependencies are not installed; no formatting mutation attempted |
| 2026-08-30 | `pnpm install --frozen-lockfile` | Passed | Existing lockfile dependencies became available; no lockfile change |
| 2026-08-30 | scoped Prettier plus `tsc --noEmit` | Passed | ADR-0026 source, tests, ADRs and tracker |
| 2026-08-30 | scoped ADR-0026 Vitest | Passed | 3 files / 13 tests; sandbox spawn was blocked, approved outside-sandbox rerun passed |

## Commits and remote state

- `3ba504a` — `docs: accept M3 CLI architecture`.
- Branch is local; no PR exists yet.

## Known risks and watch points

- SQLite WAL/SHM behavior must be proven on the supported Windows runtime without
  weakening the zero-canonical-write assertion.
- The existing M2 composition is write-capable and must never be reused as the CLI
  composition root.
- `inventory --tag` is deliberately limited to exact stored effect facets and must not
  drift into inferred M14 taxonomy.
- The CLI envelope and M2 campaign export are separate versioned formats.

## Exact resume point

ADR-0026 core implementation and focused tests are complete and ready for its scoped
commit. After committing, begin ADR-0027 with typed inspection DTOs/service and SQLite
projections. Finish the M3 composition by exposing only inspection, validation, export
and close. Do not add argv parsing/renderers until ADR-0028 and do not start M4.
