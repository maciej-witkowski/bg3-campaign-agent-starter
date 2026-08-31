# ADR-0028: Versioned M3 CLI process and output contract

Status: Accepted

Milestone: M3 — Read-Only CLI

## Context and problem statement

M3 requires a usable local command-line interface and a stable machine-readable JSON
option. Stability includes more than serializing a DTO: scripts need a discoverable
entry point, strict argument grammar, predictable stdout/stderr separation, error
codes, deterministic JSON and process exit statuses. Human output should remain useful
in Polish without becoming the machine contract.

The repository currently exposes a library package only. It has no executable entry,
database-path configuration or CLI parsing dependency. Adding a framework would be a
runtime dependency decision, while ad hoc parsing risks accepting ambiguous or ignored
arguments.

## Decision drivers and invariants

- One production entry point must expose exactly the M3 commands and no mutation/import
  command.
- Every invocation must identify the intended existing database explicitly.
- JSON output must be versioned, deterministic and contain exactly one document on
  stdout.
- Human diagnostics and machine output must never be interleaved.
- Invalid or unknown arguments must fail closed.
- Errors must be safe, typed and script-detectable without printing SQL, stack traces or
  private snapshots by default.
- Export artifact format is distinct from the CLI's result-rendering format.
- M3 should not add a runtime dependency when Node 22 provides sufficient strict
  parsing primitives.

## Considered options

### Option A — Native Node parser, one executable and a versioned result envelope

Use `node:util` argument parsing with explicit command schemas. Publish one package
`bin` entry and a convenience package script. Render command DTOs as Polish text or a
strict V1 JSON result envelope.

### Option B — Add a full CLI framework

A framework provides help generation and subcommands, but adds a runtime dependency and
abstraction surface for a small fixed command set.

### Option C — Parse `process.argv` manually without schemas

This avoids a dependency but makes duplicate, repeated, missing and unknown option
behavior easy to implement inconsistently.

### Option D — Print human tables and ask scripts to parse them

This fails the stable machine-readable output requirement.

### Option E — Print raw command data as unversioned JSON

This works initially but leaves no compatibility boundary for automation and does not
standardize errors or warnings.

### Option F — Select a default database from the current directory

This is convenient, but risks opening or exporting the wrong campaign. An explicit path
is safer for canonical-state inspection.

## Proposed decision and rationale

Select Option A.

### Executable and invocation

Publish one executable named `bg3-campaign` backed by a thin production ESM entry point,
plus a `pnpm cli -- ...` convenience script. Use Node 22's native argument parser; add
no CLI parsing dependency.

Every data command requires global `--db <path>`. There is no implicit database filename
and no in-memory database. `--help` and `--version` do not require a database. Relative
paths resolve from the caller's working directory and errors display the resolved path
only when needed for local remediation.

The accepted command grammar is:

```text
bg3-campaign --db <path> [--json] party
bg3-campaign --db <path> [--json] character <name>
bg3-campaign --db <path> [--json] equipment <name>
bg3-campaign --db <path> [--json] inventory [--slot <slot>]... [--status <status>]... [--tag <tag>]...
bg3-campaign --db <path> [--json] spells <name>
bg3-campaign --db <path> [--json] illithid [name]
bg3-campaign --db <path> [--json] changes [--limit <positive-integer>]
bg3-campaign --db <path> [--json] validate
bg3-campaign --db <path> [--json] export --format <json|xlsx> --output <path> [--overwrite]
```

Global options may appear before or after the command only where the native parser can
handle them unambiguously; the documented canonical form places them before the
command. Unknown commands/options, missing values, extra positionals, duplicate
single-value options and invalid enum/integer values fail before the database opens.
Repeatable inventory filters preserve all supplied values and are normalized/deduplicated
by the application request contract.

`--json` selects the CLI result renderer for any command, including `export`. For
`export`, it reports artifact metadata and the resolved target; it does not print the
JSON campaign artifact itself. `--format json|xlsx` controls the file written by export
and is unrelated to `--json`.

### JSON success and error envelopes

Successful machine output is exactly one UTF-8 JSON document followed by one newline:

```json
{
  "format": "BG3_CLI_RESULT",
  "version": 1,
  "command": "party",
  "ok": true,
  "data": {},
  "warnings": []
}
```

Failed machine output uses the same envelope identity and command when known:

```json
{
  "format": "BG3_CLI_RESULT",
  "version": 1,
  "command": "character",
  "ok": false,
  "error": {
    "code": "CHARACTER_NOT_FOUND",
    "messagePl": "Nie znaleziono postaci.",
    "details": {}
  },
  "warnings": []
}
```

Success has `data` and no `error`; failure has `error` and no `data`. Keys are emitted in
the documented order, arrays use ADR-0027 ordering and optional domain values are
explicit `null`. `details` is a command-specific, bounded object with a stable shape for
documented error codes. Unknown internal errors map to a safe `INTERNAL_ERROR` without
a stack trace. A future breaking field or semantic change requires a new envelope
version; additive fields require explicit compatibility documentation and tests.

### Human output and stream discipline

Human success output uses concise Polish headings/tables and a consistent `— brak —` or
`nieznane` representation documented per field. It is intentionally not a stable parser
contract. Human failures go to stderr. In `--json` mode, stdout contains only the one
JSON envelope; incidental logs and diagnostics go to stderr and tests run with no
unexpected output. Help/version are textual interface metadata, not campaign result
envelopes.

### Exit statuses

- `0` — command succeeded; for `validate`, the campaign is valid.
- `2` — invocation/argument error.
- `3` — requested entity was not found or its name was ambiguous.
- `4` — database open, schema compatibility, read or campaign-validation failure;
  `validate` returns this status when violations are present even though its JSON/human
  report is complete.
- `5` — export serialization or artifact publication failure.
- `1` — unexpected internal failure after safe error mapping.

The JSON `error.code` is the primary detailed automation contract; exit statuses remain
broad categories.

## Boundaries and dependency direction

- The executable entry owns process lifecycle, parsing, renderer selection and exit code.
- A pure parser maps argv to a discriminated union of typed M3 requests and can be unit
  tested without SQLite.
- Command dispatch calls only the read-only M3 composition from ADR-0026.
- Renderers depend on ADR-0027 result DTOs and shared safe error contracts; they do not
  query repositories or calculate domain values.
- Library exports may expose parser/application/result types needed for tests, but do
  not expose the native SQLite connection or a generic command execution hook with
  write access.

## Data, migration and compatibility impact

- No schema migration or campaign-state change is proposed.
- `package.json` gains a `bin` mapping and a convenience script; build output includes
  the executable module.
- No runtime dependency is added for parsing.
- `BG3_CLI_RESULT` V1 is a read-result automation contract, not an import format,
  checkpoint, backup or canonical store.
- M2 campaign export format/version remains independently governed by ADR-0023.

## Transaction, validation, audit and rollback impact

- The entry point cannot dispatch mutation or import operations and never creates audit
  events.
- Database opening occurs only after syntax and option validation succeeds.
- Process/rendering failure after a read has no canonical rollback implication because
  no canonical write occurred.
- Export failure follows ADR-0023 artifact cleanup and ADR-0026 database isolation.
- A validation report with violations is intentionally a complete command result plus
  non-zero exit status; no repair is attempted.

## Security, privacy and external-data impact

- Strict argument schemas reject unknown options and prevent accidental fallthrough.
- Paths and user input are treated as data; no shell execution or SQL interpolation is
  performed.
- JSON mode cannot be corrupted by debug logging on stdout.
- Safe error mapping excludes SQL, stack traces, environment variables and full campaign
  snapshots.
- Human output and JSON still contain private campaign facts requested by the local
  user; the CLI does not transmit them or create telemetry.
- Explicit `--overwrite` is required before replacing an export artifact.

## Required tests and operational evidence

- Parser unit tests cover every command, help/version, option placement, repeatable
  filters, missing/duplicate/unknown options, extra positionals and invalid values.
- Renderer contract tests assert exact V1 success/error structure, key presence,
  deterministic ordering, Unicode preservation, `null` handling and trailing newline.
- Child-process integration tests run the built executable for all nine commands in
  human and JSON modes against sanitized fixtures.
- Tests prove JSON stdout contains one parseable document and no logs; human failures and
  diagnostics use stderr.
- Exit-status tests cover success, usage, not-found, ambiguous, stale/new schema,
  validation violation, export conflict/publication failure and unexpected failure.
- `export --json --format json` proves the result envelope and exported campaign JSON are
  separate outputs.
- Help and README/operator documentation list the exact grammar, exit statuses, privacy
  warning and examples using non-private paths.
- Package/build smoke tests prove the declared executable resolves from production
  output on supported Node versions.

## Implementation evidence

- `parseCliArguments()` uses Node's strict native parser with an explicit option schema,
  command-level option allowlists, duplicate single-value rejection, typed enums,
  bounded limits and exact positional arity before any database is opened.
- `runCli()` owns application lifecycle, typed dispatch, safe error mapping and the
  approved exit categories. Every opened application is closed in `finally`, including
  failure paths.
- `BG3_CLI_RESULT` V1 success/failure constructors emit the documented key shapes and
  exactly one pretty UTF-8 JSON document plus one newline. Dates serialize as canonical
  ISO UTC strings and failures never include `data`.
- Human renderers provide compact Polish sections and the consistent empty/unknown
  markers; the party view includes the recorded class, optional subclass and each
  base/effective attribute pair. Human failures use stderr; JSON-mode failures use
  stdout only.
- Export dispatch calls the approved M2 JSON/XLSX writers, reports only bounded artifact
  metadata and keeps the campaign export body in the explicit output file.
- `package.json` declares `bg3-campaign` at `dist/cli/main.js`, the ESM entry retains a
  Node shebang and `pnpm cli -- ...` invokes the production build output. No CLI runtime
  dependency was added.
- Parser/envelope/runner coverage passed 3 files / 34 tests, including help/version,
  all command grammars, negative arguments, stream separation, validation exit 4,
  JSON/XLSX dispatch and database/export/internal error mapping.
- The production smoke creates a sanitized latest-schema file, launches the built CLI
  as a child process for all nine commands, parses every V1 envelope, verifies the JSON
  export artifact, rejects database/companion overwrite targets and proves the canonical
  SQLite SHA-256 is unchanged.

## Consequences and trade-offs

- Scripts receive a small explicit versioned contract while humans get localized output.
- Requiring `--db` is more verbose but prevents a dangerous implicit campaign choice.
- Native parsing avoids a dependency but requires maintained help text and a modest
  command-schema layer.
- A non-zero status for invalid campaign state makes shell automation fail safely while
  still returning a complete validation report.
- Maintaining both human and JSON renderers adds tests, but both share one query DTO and
  cannot drift in data acquisition.

## Rejected alternatives

- A default database path is rejected because the wrong working directory could inspect
  or export the wrong campaign.
- Unversioned JSON and parsing human tables are rejected as unstable automation
  contracts.
- Printing logs beside JSON is rejected because it breaks machine consumers.
- A new CLI framework is rejected for this fixed M3 grammar unless implementation
  evidence shows the native parser cannot enforce the approved contract; that discovery
  would require a new proposed ADR before adding a dependency.
- Exposing import or mutation commands is rejected as M2/M4/M6 behavior outside M3.

## Unresolved questions

None blocking. Exact column widths, color use and terminal capability detection may be
refined without changing command semantics, stream separation, JSON V1 or exit codes;
tests must not require color.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-30.
- Approval scope: the complete ADR-0028 proposal without requested changes.

## Change log

- 2026-08-30 — Initial M3 proposal.
- 2026-08-30 — Accepted after explicit repository-owner approval.
- 2026-08-30 — Implemented the strict native parser, process dispatcher/lifecycle,
  Polish and V1 JSON renderers, stable exit/error mapping, package executable and
  production child-process smoke coverage.
- 2026-08-30 — After approved PR review remediation, added pre-open export target
  collision checks and process coverage for protected SQLite paths without changing the
  V1 envelope or exit-status contract.
- 2026-08-30 — After approved final-review remediation, derived failure-envelope command
  identity only from the parser's command position and returned `null` when no known
  command could be identified; added regressions for misleading option/argument values.
- 2026-08-30 — After approved follow-up review remediation, made the lenient token
  context preserve an earlier known command across later option errors and select JSON
  mode only from an actual `--json` option token, including option-terminator coverage.
- 2026-08-30 — After approved final re-review remediation, rendered the party DTO's
  base/effective attributes in human mode and added a focused output regression.
- 2026-08-31 — After approved later re-review remediation, included a recorded subclass
  in the human party summary and extended the exact output regression.
