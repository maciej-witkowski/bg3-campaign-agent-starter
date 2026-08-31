# M3 Implementation Tracker

Milestone: M3 — Read-Only CLI
Branch: `codex/m3-read-only-cli`
Started: 2026-08-30
Last updated: 2026-08-31
Overall status: Twelfth approved PR review remediation validated; tracking/publish/re-review pending

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

### Session follow-up final re-review remediation — approved path anchoring/inventory package

Status: Implemented as two ADR-scoped commits; full local gate passed

Follow-up findings on `418c8c0`:

- P1: a relative database path was resolved again during a later export, so
  `process.chdir()` could change which path the public policy protected;
- P2: `inventory` returned contradictory equipment assignments even though equipment is
  a required joined fact in that DTO.

Approval: both remediations were explicitly approved by the repository owner in the
Codex task on 2026-08-31.

Implemented:

- ADR-0026 (`3ddfd27`): protected resolved and canonical database/companion identities
  are captured when the application opens and retained by the export target policy;
- ADR-0027 (`7bdf946`): inventory assignments reuse the equipment view's status, owner,
  quantity and known-slot integrity check;
- regressions change the working directory after opening a relative database and cover
  all four contradictory equipment facts in both projections.

ADR impact: no new or changed architectural decision. Both fixes enforce the accepted
path-isolation and required-join-consistency rules.

### Session subsequent re-review remediation — approved missing/scoped assignment package

Status: Implemented as ADR-0027 commit `7145e8d`; full local gate passed

Subsequent findings on `cee9d86`:

- P2: a returned `EQUIPPED` inventory instance without an assignment was rendered with
  `equipment: null`, and the character equipment view could silently omit it;
- P2: inventory assignment integrity ran before filters and could fail a query because
  of an unrelated row excluded from the result.

Approval: both remediations were explicitly approved by the repository owner in the
Codex task on 2026-08-31.

Implemented:

- returned inventory rows with status `EQUIPPED` require an assignment;
- character equipment rejects a character-owned `EQUIPPED` instance without an
  assignment;
- status filtering and remaining projection filtering precede owner/assignment
  integrity checks, so excluded contradictory rows do not fail an unrelated query;
- regressions distinguish missing required assignments from filtered-out inconsistent
  facts.

ADR impact: no new or changed architectural decision. The fix enforces ADR-0027's
required-join error rule and its explicit allowance for unrelated campaign violations.

### Session later re-review remediation — approved subclass/illithid package

Status: Implemented as ADR-scoped commits `137a235` and `889d8b0`; full local gate passed

Later findings on `5bcae33`:

- P2: human `party` output omitted a known subclass present in the approved projection;
- P2: `illithid` could omit an acquisition with a missing power definition or return a
  prerequisite edge with a missing endpoint.

Approval: both remediations were explicitly approved by the repository owner in the
Codex task on 2026-08-31.

Implemented:

- ADR-0027 (`137a235`): every character acquisition and both endpoints of every
  prerequisite edge must reference a returned power definition;
- ADR-0028 (`889d8b0`): human party rows render `class / subclass` when the subclass is
  known;
- focused regressions cover acquisition, prerequisite source/target and exact localized
  party output.

ADR impact: no new or changed architectural decision. The fixes enforce ADR-0027's
required-join rule and ADR-0028's human rendering of the approved party DTO.

### Session renderer/export re-review remediation — approved anchoring/human-detail package

Status: Implemented as ADR-scoped commits `348090b` and `3e9234c`; full local gate passed

Findings on `fc185d6`:

- P1: a relative XLSX target could be re-resolved after asynchronous serialization if
  another library consumer changed the process working directory;
- P2: human character output omitted permanent modifiers and their empty state;
- P2: human spell output did not expose `known`, `prepared` and `alwaysPrepared`
  independently;
- P2: human illithid output omitted prerequisite edges.

Approval: all four remediations were explicitly approved by the repository owner in the
Codex task on 2026-08-31.

Implemented:

- ADR-0026 (`348090b`): explicit artifact targets resolve and validate once before the
  policy check and any asynchronous serialization, and the absolute path is retained
  through publication;
- ADR-0028 (`3e9234c`): human output now includes localized permanent modifier
  details/empty state, every spell assignment flag and prerequisite IDs;
- regressions change the working directory during a deferred XLSX serialization and
  assert exact human output for all three projections.

ADR impact: no new or changed architectural decision. The fixes close a path-identity
race in ADR-0026 and align ADR-0028 human output with existing approved DTO facts.

### Session canonical schema/path re-review remediation — approved manifest/target package

Status: Implemented as ADR-scoped commits `38b4d87` and `7f0bbd4`; full local gate passed

Findings on `0463d7b`:

- P1: a directory symlink/junction could be redirected after target checking because
  publication retained only a lexical absolute path;
- P2: schema compatibility verified the migration ledger and table names but not changed
  columns, indexes or other required schema objects;
- P2: CLI export metadata re-resolved the target after asynchronous work and could report
  a different path than the published artifact.

Approval: all three remediations were explicitly approved by the repository owner in
the Codex task on 2026-08-31.

Implemented:

- ADR-0026 (`38b4d87`): artifact publication uses the existing canonical parent captured
  before serialization, and the compatibility verifier compares a complete sorted
  `sqlite_schema` manifest with an isolated migration-derived in-memory reference;
- ADR-0028 (`7f0bbd4`): CLI resolves the output target once before dispatch and reports
  the exact path passed to policy/publication;
- regressions redirect a junction during deferred serialization, remove a required
  index, rename a required column and change the process working directory during CLI
  export.

ADR impact: no new or changed architectural decision. The fixes enforce ADR-0026's
exact structural compatibility and isolated export path, plus ADR-0028's truthful
bounded export metadata.

### Session publication-identity re-review remediation — approved stable-target package

Status: Implemented as ADR-scoped commit `e9052d7`; full local gate passed

Finding on `955ece5`:

- P1: the exporter canonicalized and policy-checked its target before serialization but
  the writer resolved it again afterwards, so replacing the checked canonical directory
  with a junction could redirect publication to a protected database path.

Approval: the remediation was explicitly approved by the repository owner in the Codex
task on 2026-08-31.

Implemented:

- ADR-0026 (`e9052d7`): target preparation now captures the canonical absolute path and
  parent filesystem device/inode before serialization; the writer accepts that prepared
  target and revalidates it before creating a temporary file and immediately before
  dispatching the final rename/link;
- regressions replace the canonical directory with a database-directed junction during
  deferred serialization and during temporary-artifact verification, require a typed
  failure and prove the database sentinel remains unchanged.

ADR impact: no new or changed architectural decision. The fix closes the remaining
time-of-check/time-of-use gap in ADR-0026's accepted explicit export boundary.

### Session parser/lifecycle re-review remediation — approved error-boundary package

Status: Implemented as ADR-scoped commit `a77aefa`; full local gate passed

Findings on `062c781`:

- P2: lenient error-context recovery could treat `--json` after the raw `--` terminator
  as an option when an earlier malformed string option consumed the terminator as its
  value;
- P2: an exception from `application.close()` in `finally` could replace a successful
  result or an already mapped failure and escape the stable CLI error boundary.

Approval: both remediations were explicitly approved by the repository owner in the
Codex task on 2026-08-31.

Implemented:

- ADR-0028 (`a77aefa`): context recovery considers only parsed tokens whose raw index is
  before the first exact `--`; application close failures after successful execution map
  to a safe `INTERNAL_ERROR`, while an earlier command failure retains precedence;
- regressions cover a malformed `--output -- --json` invocation, close failure after a
  successful command and close failure after an already mapped not-found result.

ADR impact: no new or changed architectural decision. The fixes enforce ADR-0028's
accepted option-terminator, stable-envelope and lifecycle error-boundary contracts.

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

### Modified in follow-up final re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/export/campaign-export-service.ts`
- `src/application/export/campaign-export-target.ts`
- `src/application/inspection/campaign-inspection-service.ts`
- `src/composition/m3-campaign-application.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`
- `tests/unit/application/m3-campaign-application.test.ts`

### Modified in subsequent re-review remediation session

- `docs/TESTING.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/inspection/campaign-inspection-service.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`

### Modified in later re-review remediation session

- `docs/TESTING.md`
- `docs/adr/0027-m3-cli-query-semantics.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/inspection/campaign-inspection-service.ts`
- `src/cli/human-renderer.ts`
- `tests/unit/application/campaign-inspection-service.test.ts`
- `tests/unit/cli/human-renderer.test.ts`

### Created in renderer/export re-review remediation session

- `tests/unit/application/campaign-export-service.test.ts`

### Modified in renderer/export re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/export/atomic-artifact-writer.ts`
- `src/application/export/campaign-export-service.ts`
- `src/cli/human-renderer.ts`
- `tests/unit/cli/human-renderer.test.ts`

### Modified in canonical schema/path re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/export/atomic-artifact-writer.ts`
- `src/cli/run-cli.ts`
- `src/persistence/sqlite/schema-compatibility.ts`
- `tests/unit/application/campaign-export-service.test.ts`
- `tests/unit/cli/run-cli.test.ts`
- `tests/unit/persistence/schema-compatibility.test.ts`

### Modified in publication-identity re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0026-m3-read-only-sqlite-cli-boundary.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/application/export/atomic-artifact-writer.ts`
- `src/application/export/campaign-export-service.ts`
- `tests/unit/application/atomic-artifact-writer.test.ts`
- `tests/unit/application/campaign-export-service.test.ts`

### Modified in parser/lifecycle re-review remediation session

- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/adr/0028-versioned-cli-process-and-output-contract.md`
- `docs/milestones/M3_IMPLEMENTATION_TRACKER.md`
- `src/cli/parse-cli-arguments.ts`
- `src/cli/run-cli.ts`
- `tests/unit/cli/run-cli.test.ts`

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
| 2026-08-31 | focused follow-up final re-review regressions | Passed | 4 files / 28 tests covering anchored relative paths and equipment integrity in both projections |
| 2026-08-31 | post-follow-up-final-re-review `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 39 files / 241 tests, build and production smoke |
| 2026-08-31 | follow-up `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | follow-up scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused subsequent ADR-0027 regressions | Passed | 2 files / 25 tests covering required missing assignments and filtered-out contradictions |
| 2026-08-31 | post-subsequent-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 39 files / 243 tests, build and production smoke |
| 2026-08-31 | subsequent `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | subsequent scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused later ADR-0027/0028 regressions | Passed | 2 files / 25 tests covering dangling illithid joins and exact subclass output |
| 2026-08-31 | post-later-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 39 files / 246 tests, build and production smoke |
| 2026-08-31 | later `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | later scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused renderer/export regressions | Passed | 4 files / 17 tests covering deferred target anchoring and exact human details |
| 2026-08-31 | post-renderer-export-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 40 files / 250 tests, build and production smoke |
| 2026-08-31 | renderer/export `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | renderer/export scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused canonical path/schema regressions | Passed | 5 files / 24 tests including redirected junction, full schema manifest and anchored CLI metadata |
| 2026-08-31 | post-canonical-schema-remediation `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 40 files / 254 tests and build |
| 2026-08-31 | standalone post-remediation production smoke | Passed | All nine built commands and protected export targets completed successfully |
| 2026-08-31 | canonical-schema `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | canonical-schema scope/security sweep | Passed | No migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused publication-identity regressions | Passed | 2 files / 6 tests covering replacement during deferred serialization and final verification |
| 2026-08-31 | post-publication-identity `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 40 files / 256 tests, build and production smoke |
| 2026-08-31 | publication-identity `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | publication-identity scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |
| 2026-08-31 | focused parser/lifecycle regressions | Passed | 2 files / 37 tests covering raw `--` recovery and close failures after success/failure |
| 2026-08-31 | post-parser-lifecycle `pnpm check` | Passed | Prettier, ESLint, strict typecheck, 40 files / 257 tests, build and production smoke |
| 2026-08-31 | parser/lifecycle `pnpm audit --audit-level high` | Passed | No high/critical findings; the same two inherited moderate advisories remain in the unchanged dependency graph |
| 2026-08-31 | parser/lifecycle scope/security sweep | Passed | No schema, migration, dependency, campaign-data, mutation-command or M4 change; diff and whitespace checks clean |

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
- `418c8c0` — `docs: track final M3 review remediation`.
- `3ddfd27` — `fix: anchor M3 protected export paths`.
- `7bdf946` — `fix: validate inventory equipment joins`.
- `cee9d86` — `docs: track M3 path and inventory remediation`.
- `7145e8d` — `fix: scope inventory consistency validation`.
- `5bcae33` — `docs: track scoped inventory remediation`.
- `137a235` — `fix: reject dangling illithid joins`.
- `889d8b0` — `fix: render party subclass in human CLI`.
- `fc185d6` — `docs: track subclass and illithid remediation`.
- `348090b` — `fix: anchor export targets before serialization`.
- `3e9234c` — `fix: complete M3 human inspection output`.
- `0463d7b` — `docs: track export and renderer remediation`.
- `38b4d87` — `fix: verify canonical M3 paths and schema`.
- `7f0bbd4` — `fix: report anchored CLI export targets`.
- `955ece5` — `docs: track canonical schema remediation`.
- `e9052d7` — `fix: bind export publication to checked target`.
- `062c781` — `docs: track stable export publication`.
- `a77aefa` — `fix: contain CLI parser and close failures`.
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

The two P2 findings from review of `062c781` were verified, approved and implemented in
ADR-scoped commit `a77aefa`. The full local gate passed at 40 files / 257 tests plus
production smoke, and the high-severity audit passed with only the two unchanged
moderate transitive advisories. Resume by committing this tracking evidence, pushing
the two local commits and requesting Codex re-review on the latest head. Do not merge
and do not start M4.
