# M3 Implementation Tracker

Milestone: M3 — Read-Only CLI
Branch: `codex/m3-read-only-cli`
Started: 2026-08-30
Last updated: 2026-08-30
Overall status: Local implementation and validation complete; PR delivery in progress

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
| ADR-0026 | Dedicated read-only SQLite connection/composition and isolated export writes | Accepted by repository owner, 2026-08-30 | Complete: `362a10f` plus ADR-0027 composition integration |
| ADR-0027 | Typed command projections, deterministic resolution/filter/order semantics | Accepted by repository owner, 2026-08-30 | Complete: `c63d236` |
| ADR-0028 | Native Node parser, explicit DB path, V1 envelope and stable exit categories | Accepted by repository owner, 2026-08-30 | Complete: `ffc2707` |

## Session ledger

### Session ADR-0026 — read-only persistence and composition

Status: Complete — committed as `362a10f`

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

Status: Complete — committed as `c63d236`

Implemented:

- typed query requests/results, safe errors and root exports;
- deterministic canonical/display-name resolution and all command-specific projections;
- effective attribute calculation and exact inventory effect-facet filters;
- summary-only bounded audit reads and explicit no-inference illithid output;
- transaction-scoped SQLite read port and completed M3 composition;
- focused SQLite/application integration tests and ADR evidence.

Validation: scoped Prettier, ESLint and strict typecheck passed; 2 focused files / 12
tests passed outside the sandbox.

Handoff: ADR-0028 must add only argv parsing, dispatch, renderers, process lifecycle,
package executable metadata and child-process integration tests over this application
surface. Do not alter approved query semantics or add M4 tools.

### Session ADR-0028 — process contract and renderers

Status: Complete — committed as `ffc2707`

Implemented:

- strict native Node argument parser with command option scopes and pre-open failures;
- human Polish and `BG3_CLI_RESULT` V1 JSON renderers;
- stdout/stderr discipline, safe error mapping and stable exit codes;
- JSON/XLSX export dispatch with metadata-only command results;
- package executable, convenience script and version update to 0.3.0;
- production child-process smoke for all nine commands and focused contract tests;
- implementation evidence.

Validation: scoped Prettier, ESLint and strict typecheck passed; 3 focused files / 34
tests passed; production build and child-process smoke passed for all commands with an
unchanged SQLite SHA-256.

Handoff: milestone-facing documentation and CHANGELOG are complete. The full local gate
passed; finish the cumulative stabilization review, commit documentation, then push and
open the M3 PR. Do not start M4.

### Session milestone documentation and stabilization

Status: Complete — ready for documentation commit

Implemented:

- dedicated CLI reference covering safety, grammar, lookup/filter semantics, envelopes
  and exit statuses;
- README, architecture, testing, security and operations guidance aligned with M3;
- M3 changelog entry and durable delivery evidence.

Validation: the full `pnpm check` gate passed with 36 test files / 223 tests, production
build and real-process smoke for all nine commands.

Stabilization: cumulative scope/state/security/ADR review found no local implementation
finding. No schema, migration, runtime dependency, canonical campaign data or later-
milestone feature is present in the diff.

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

### Created in ADR-0027 session

- `src/domain/naming/polish-matching.ts`
- `src/application/inspection/campaign-inspection.ts`
- `src/application/inspection/campaign-inspection-service.ts`
- `src/persistence/sqlite/campaign-inspection-read-port.ts`
- `src/composition/m3-campaign-application.ts`
- `tests/unit/fixtures/m3-campaign-fixture.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`
- `tests/unit/application/m3-campaign-application.test.ts`

### Modified in ADR-0027 session

- `src/application/import/legacy-normalization.ts`
- `src/index.ts`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`

### Created in ADR-0028 session

- `src/cli/cli-contract.ts`
- `src/cli/parse-cli-arguments.ts`
- `src/cli/cli-envelope.ts`
- `src/cli/human-renderer.ts`
- `src/cli/run-cli.ts`
- `src/cli/main.ts`
- `tests/unit/cli/parse-cli-arguments.test.ts`
- `tests/unit/cli/cli-envelope.test.ts`
- `tests/unit/cli/run-cli.test.ts`

### Modified in ADR-0028 session

- `package.json`
- `scripts/smoke-production.mjs`
- `src/index.ts`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`

### Created in milestone documentation session

- `docs/CLI.md`

### Modified in milestone documentation session

- `CHANGELOG.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`

## Validation ledger

| Date | Command | Result | Scope/notes |
| --- | --- | --- | --- |
| 2026-08-30 | ADR required-section/trailing-whitespace check | Passed | Three proposed ADRs before approval |
| 2026-08-30 | `git pull --ff-only` | Passed | `main` already current before branch creation |
| 2026-08-30 | scoped Prettier check | Blocked | Dependencies are not installed; no formatting mutation attempted |
| 2026-08-30 | `pnpm install --frozen-lockfile` | Passed | Existing lockfile dependencies became available; no lockfile change |
| 2026-08-30 | scoped Prettier plus `tsc --noEmit` | Passed | ADR-0026 source, tests, ADRs and tracker |
| 2026-08-30 | scoped ADR-0026 Vitest | Passed | 3 files / 13 tests; sandbox spawn was blocked, approved outside-sandbox rerun passed |
| 2026-08-30 | scoped ADR-0027 Prettier, ESLint and `tsc --noEmit` | Passed | Query contracts/service, SQLite port, composition, fixture and tests |
| 2026-08-30 | scoped ADR-0027 Vitest | Passed | 2 files / 12 tests including all projections, negative paths and export isolation |
| 2026-08-30 | scoped ADR-0028 Prettier, ESLint and `tsc --noEmit` | Passed | Parser, contracts, renderers, runner, entry point and tests |
| 2026-08-30 | scoped ADR-0028 Vitest | Passed | 3 files / 34 tests covering grammar, V1 envelopes, streams, errors and export dispatch |
| 2026-08-30 | production build plus `scripts/smoke-production.mjs` | Passed | Built executable spawned for all nine commands; export valid; SQLite hash unchanged |
| 2026-08-30 | `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 36 files / 223 tests, production build and real-process smoke |
| 2026-08-30 | `pnpm audit --audit-level high` | Passed | No high/critical findings; two inherited moderate advisories in unchanged dependency graph |
| 2026-08-30 | cumulative M3 stabilization review | Passed | Scope, state safety, ADR alignment, failure paths, docs and generated/private-file sweep |

## Commits and remote state

- `3ba504a` — `docs: accept M3 CLI architecture`.
- `362a10f` — `feat: enforce M3 read-only persistence`.
- `c63d236` — `feat: add M3 campaign inspection queries`.
- `ffc2707` — `feat: add M3 read-only CLI process`.
- Branch is local; no PR exists yet.

## Known risks and watch points

- SQLite WAL/SHM behavior must be proven on the supported Windows runtime without
  weakening the zero-canonical-write assertion.
- The existing M2 composition is write-capable and must never be reused as the CLI
  composition root.
- `inventory --tag` is deliberately limited to exact stored effect facets and must not
  drift into inferred M14 taxonomy.
- The CLI envelope and M2 campaign export are separate versioned formats.
- The unchanged dependency graph reports two moderate advisories: development-only
  `esbuild` below 0.24.3 through `drizzle-kit`, and `uuid` below 11.1.1 through
  `exceljs`. Neither is introduced by M3; dependency remediation remains separately
  scoped.

## Exact resume point

All three ADR implementation sessions, milestone documentation, the full local gate and
the cumulative stabilization review are complete. Resume by committing the documentation,
then push `codex/m3-read-only-cli`, open the PR, wait for CI/security checks and request
Codex review. Do not remediate review findings without explicit user approval, and do
not start M4.
