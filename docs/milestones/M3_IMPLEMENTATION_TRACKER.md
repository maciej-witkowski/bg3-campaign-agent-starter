# M3 Implementation Tracker

Milestone: M3 — Read-Only CLI
Branch: `codex/m3-read-only-cli`
Started: 2026-08-30
Last updated: 2026-08-30
Overall status: Fifth approved PR review remediation validated; publish/re-review pending

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

### Session PR review remediation — approved P1/P2

Status: Implementation committed as `be207a9`; documentation and full revalidation
complete

Review findings on `078efe5`:

- P1: an overwrite export target could alias the campaign database or a SQLite companion;
- P2: standalone validation reads did not share one SQLite snapshot.

Approval: both remediations explicitly approved by the repository owner in the Codex
task on 2026-08-30.

Implemented:

- pre-open export target protection for resolved source paths, canonical filesystem
  aliases and `-wal`, `-shm`, `-journal` companions;
- one transaction-scoped validation read port around the complete deterministic validator;
- focused filesystem-alias, CLI mapping, production-process and concurrent-WAL snapshot
  regressions;
- ADR-0026/0028 implementation evidence and operational documentation updates.

ADR impact: no new or changed architectural decision. Both fixes enforce the already
accepted ADR-0026 transactional-read and isolated-export boundary.

### Session PR re-review remediation — approved tag OR finding

Status: Implementation committed as `db0b15e`; full revalidation complete

Re-review finding on `748911f`: repeated `inventory --tag` values were implemented with
AND despite ADR-0027 requiring OR within a filter category.

Approval: remediation explicitly approved by the repository owner in the Codex task on
2026-08-30.

Implemented:

- exact tag-facet matching now accepts any repeated requested tag while retaining AND
  between slot, status and tag categories;
- a regression proves `BONUS` or `AURA` returns items matching either alternative.

ADR impact: no new or changed decision; this restores the already accepted ADR-0027
filter contract.

### Session final PR review remediation — approved command identity finding

Status: Implementation committed as `f220fab`; full revalidation complete

Final-review finding on `29e9a60`: the failure-envelope command hint scanned every argv
value, so an option value or later positional could be reported as the command.

Approval: remediation explicitly approved by the repository owner in the Codex task on
2026-08-30.

Implemented:

- command hints now come from the first positional returned by the same strict native
  parser used for dispatch;
- unknown or unparseable command positions produce `command: null`;
- regressions cover a command name in a later positional and in the `--db` value.

ADR impact: no new or changed decision; this restores ADR-0028's known-command-only
failure envelope.

### Session follow-up PR review remediation — approved parser context package

Status: Implementation committed as `83f73ff`; full revalidation complete

Follow-up review findings on `fb22d48`:

- a known command was lost when a later option made strict parsing fail;
- raw argv membership treated positional `--json` after `--` as JSON mode;
- one ADR-0027 sentence still described tag AND semantics despite the accepted OR rule.

Approval: the combined three-finding remediation was explicitly approved by the
repository owner in the Codex task on 2026-08-30.

Implemented:

- a lenient native-parser token context extracts the first positional command and actual
  JSON option independently from strict dispatch validation;
- regressions cover a known command followed by an unknown option and positional
  `--json` after the option terminator;
- ADR-0027 now consistently states that at least one repeated tag must match.

ADR impact: no new or changed decision; the fixes enforce ADR-0028 stream/envelope
semantics and remove documentation drift from ADR-0027.

### Session final re-review remediation — approved public export/equipment/human-output package

Status: Implemented as three ADR-scoped commits; full local gate passed

Final re-review findings on `0dc7796`:

- P1: callers of the public M3 composition could bypass the CLI-only protected export
  target check;
- P2: the equipment projection rendered assignments despite contradictory required
  inventory/definition facts;
- P2: human `party` output omitted effective attributes present in the approved DTO.

Approval: the combined three-finding remediation was explicitly approved by the
repository owner in the Codex task on 2026-08-30.

Implemented:

- ADR-0026 (`1f1637d`): the public M3 export service now applies the database and SQLite
  companion target policy to JSON and XLSX writes, while CLI pre-open rejection remains;
- ADR-0027 (`93c1f4e`): equipment views require `EQUIPPED`, matching owner, quantity one
  and a compatible known definition slot, reusing the validator's compatibility rule;
- ADR-0028 (`0459085`): human party rows render every base/effective attribute pair;
- regressions exercise direct public export calls, all four contradictory equipment
  facts and exact human party output.

ADR impact: no new or changed architectural decision. The package closes bypasses and
output drift against the already accepted ADR-0026/0027/0028 contracts.

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

### Created in PR review remediation session

- `src/cli/campaign-export-target.ts`
- `src/persistence/sqlite/campaign-validation-read-port.ts`
- `tests/unit/cli/campaign-export-target.test.ts`
- `tests/unit/persistence/campaign-validation-read-port.test.ts`

### Modified in PR review remediation session

- `CHANGELOG.md`
- `docs/CLI.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `scripts/smoke-production.mjs`
- `src/application/inspection/campaign-validation-service.ts`
- `src/cli/run-cli.ts`
- `src/composition/m3-campaign-application.ts`
- `src/index.ts`
- `tests/unit/application/campaign-validation-service.test.ts`
- `tests/unit/cli/run-cli.test.ts`

### Modified in PR re-review remediation session

- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/inspection/campaign-inspection-service.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`

### Modified in final PR review remediation session

- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/cli/parse-cli-arguments.ts`
- `src/cli/run-cli.ts`
- `tests/unit/cli/run-cli.test.ts`

### Modified in follow-up PR review remediation session

- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/cli/parse-cli-arguments.ts`
- `src/cli/run-cli.ts`
- `tests/unit/cli/run-cli.test.ts`

### Created in final re-review remediation session

- `tests/unit/cli/human-renderer.test.ts`

### Moved in final re-review remediation session

- `src/cli/campaign-export-target.ts` to
  `src/application/export/campaign-export-target.ts`

### Modified in final re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/export/campaign-export-service.ts`
- `src/application/inspection/campaign-inspection-service.ts`
- `src/cli/human-renderer.ts`
- `src/cli/run-cli.ts`
- `src/composition/m3-campaign-application.ts`
- `src/domain/validation/campaign-validation.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`
- `tests/unit/application/m3-campaign-application.test.ts`
- `tests/unit/cli/campaign-export-target.test.ts`

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
| 2026-08-30 | focused approved P1/P2 remediation tests | Passed | 5 files / 16 tests including export aliases and concurrent WAL snapshot |
| 2026-08-30 | remediation production build and smoke | Passed | Protected DB/WAL/SHM targets rejected; SQLite hash unchanged |
| 2026-08-30 | post-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 38 files / 229 tests, build and protected-target production smoke |
| 2026-08-30 | focused repeated-tag OR regression | Passed | 1 file / 11 tests plus scoped lint and strict typecheck |
| 2026-08-30 | post-tag-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 38 files / 229 tests, build and production smoke |
| 2026-08-30 | focused JSON command-identity regression | Passed | 2 files / 34 tests plus scoped lint and strict typecheck |
| 2026-08-30 | post-command-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 38 files / 230 tests, build and production smoke |
| 2026-08-30 | focused parser-context regressions | Passed | 2 files / 35 tests plus scoped lint and strict typecheck |
| 2026-08-30 | post-parser-context `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 38 files / 231 tests, build and production smoke |
| 2026-08-30 | focused final re-review regressions | Passed | 5 files / 24 tests covering the public export boundary, equipment contradictions, shared slot logic and human attributes |
| 2026-08-30 | post-final-re-review `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 39 files / 236 tests, build and production smoke |
| 2026-08-30 | post-final-re-review `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-30 | final re-review scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |

## Commits and remote state

- `3ba504a` — `docs: accept M3 CLI architecture`.
- `362a10f` — `feat: enforce M3 read-only persistence`.
- `c63d236` — `feat: add M3 campaign inspection queries`.
- `ffc2707` — `feat: add M3 read-only CLI process`.
- `de216ed` — `docs: document M3 read-only CLI`.
- `078efe5` — `docs: track M3 pull request`.
- `be207a9` — `fix: protect M3 read-only boundaries`.
- `748911f` — `docs: record M3 review remediation`.
- `db0b15e` — `fix: combine repeated inventory tags with OR`.
- `29e9a60` — `docs: record M3 tag remediation`.
- `f220fab` — `fix: derive CLI error command from parser`.
- `fb22d48` — `docs: record M3 command remediation`.
- `83f73ff` — `fix: preserve CLI parser failure context`.
- `0dc7796` — `docs: record M3 parser context remediation`.
- `1f1637d` — `fix: enforce M3 export policy at public boundary`.
- `93c1f4e` — `fix: reject contradictory equipment views`.
- `0459085` — `fix: render party attributes in human CLI`.
- Branch is published as `origin/codex/m3-read-only-cli`.
- Pull request: `https://github.com/maciej-witkowski/bg3-campaign-agent-starter/pull/6`.

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

The three findings from review of `0dc7796` were verified, approved and implemented in
the ADR-scoped commits `1f1637d`, `93c1f4e` and `0459085`. The full local gate passed at
39 files / 236 tests. Resume by completing the diff/security sweep, committing this
tracking evidence, pushing the four commits and requesting Codex re-review on the
latest head. Do not merge and do not start M4.
