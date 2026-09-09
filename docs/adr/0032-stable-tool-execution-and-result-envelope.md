# ADR-0032: Stable tool execution and result envelope

Status: Accepted

Milestone: M4 — Typed Tool Layer

## Context and problem statement

The existing `ToolResult` JSON Schema defines success and failure envelopes, but M4
still needs execution semantics: when validation runs, whether handlers may throw,
whether outputs are checked, how errors are mapped, and which values are safe to cross
an LLM/provider boundary. Without one executor, each tool could leak different errors or
call domain logic before discovering malformed input.

The M3 `BG3_CLI_RESULT` envelope is process- and command-specific. Reusing it would
couple tools to CLI command names, exit statuses and rendering behavior.

## Decision drivers and invariants

- Input validation completes before handler invocation.
- Every attempted known tool call returns exactly one serializable success or failure
  envelope; expected validation/domain failures do not escape as exceptions.
- A success payload is validated before it leaves the tool layer.
- Internal failures must not leak SQL, stack traces, snapshots, secrets or arbitrary
  user payloads.
- Failure codes and details must be stable enough for non-LLM callers.
- Warnings are advisory and cannot convert a failed mutation into success.
- Tool execution remains provider-neutral and has no process exit-code semantics.

## Considered options

### Option A — One schema-first executor with input/output validation and safe mapping

Each registry uses a common executor around category-specific handlers and returns the
existing discriminated result envelope.

### Option B — Let handlers return arbitrary values or throw (effective status quo)

Adapters would need repeated validation and error mapping, producing inconsistent and
potentially unsafe behavior.

### Option C — Reuse the CLI V1 envelope

This conflates local process output with model/application tool calls and introduces
irrelevant command/version/exit concerns.

### Option D — Return Zod exceptions directly

Zod issue paths are useful internally but are not a bounded, localized or stable public
error contract by themselves.

## Proposed decision and rationale

Select Option A.

Every registry invocation accepts `unknown`, resolves one definition within that
registry's capability set, and runs this fixed sequence:

1. strict input `safeParse`;
2. category preconditions, including ADR-0033 for mutations;
3. handler invocation through its narrow port;
4. strict output-data validation;
5. construction and final validation of the `ToolResult` envelope.

Invalid input returns `ok: false` with code `INVALID_TOOL_INPUT`; neither authorization
nor the handler is called. Unknown names are resolved only inside the selected registry
and return `TOOL_NOT_FOUND`. A known catalog definition without an executable handler
is not exported by an executable registry; an attempted lower-level construction fails
closed rather than producing a callable placeholder.

Stable initial failure families are:

- `INVALID_TOOL_INPUT` — boundary schema rejection;
- `NOT_FOUND` and `AMBIGUOUS` — conservative entity resolution outcomes;
- `CONFLICT` — contradictory canonical facts or incompatible requested operation;
- `CAMPAIGN_INVALID` — deterministic campaign validation violations;
- `CONFIRMATION_REQUIRED` and `CONFIRMATION_INVALID` — ADR-0033 gate failures;
- `TOOL_OUTPUT_INVALID` — handler violated its declared output contract;
- `INTERNAL_ERROR` — unexpected failure after safe redaction.

Tool-specific codes may extend this set only when documented with bounded details.
Error payloads use the existing serialized names `code`, `message_pl`, optional
`details`; success uses `data`; both contain `warnings`. Success and failure remain
mutually exclusive and do not add the CLI's `format`, `version` or `command` fields.

Warnings are deterministic strings intended for the user in Polish. They may report
unknown optional facts or partial projections but cannot hide validation violations,
identity ambiguity or authorization failure. Warning order and returned collection
order are deterministic.

Output schemas describe JSON-safe DTOs only. Dates cross this boundary as canonical UTC
ISO-8601 strings; `undefined`, class instances, SQLite rows, `bigint`, functions and
cyclic objects are forbidden. An invalid handler output becomes a redacted
`TOOL_OUTPUT_INVALID`, never a partial success.

Expected application/domain errors are mapped explicitly. Unexpected exceptions are
redacted to `INTERNAL_ERROR`; detailed diagnostics may be recorded only by an injected
local observer receiving bounded metadata, not campaign snapshots or raw SQL. M4 does
not introduce persistent telemetry.

## Boundaries and dependency direction

- The common executor depends on schemas, safe error mappers and narrow handler ports.
- Handlers return typed data DTOs, not complete envelopes; the executor owns envelope
  consistency.
- Registry/category layers add preconditions before invoking the common handler path.
- CLI rendering and exit-code mapping remain separate consumers of application services.
- Provider adapters consume validated JSON-safe envelopes and cannot bypass execution.

## Data, migration and compatibility impact

- No database migration or campaign-state change is proposed.
- `schemas/domain/tool-result.schema.json` remains the serialized envelope authority and
  receives only documented corrections needed for strict Zod parity.
- Error codes and per-tool output schemas become public pre-1.0 contracts; incompatible
  changes require an explicit versioning decision in a later ADR.
- M3 CLI envelope compatibility is unaffected.

## Transaction, validation, audit and rollback impact

- Invalid input and authorization failures occur before transaction start and create no
  audit event.
- Read/analysis failures have no rollback implication.
- A mutation handler failure remains governed by ADR-0014: its transaction rolls back
  and the executor reports a safe failure without manufacturing an audit event.
- Output validation occurs after a handler returns. For future mutations, concrete M6
  output DTOs must be simple enough that a committed valid domain result cannot fail
  serialization; tests must prove this. Output failure must never attempt a compensating
  ad hoc write.

## Security, privacy and external-data impact

- Error details are allowlisted and bounded by tool/error family.
- Raw Zod inputs, stack traces, SQL and before/after snapshots are excluded from normal
  results.
- The executor performs no network access and emits no telemetry.
- External/research content remains data and cannot change registry or execution rules.

## Required tests and operational evidence

- Spy tests prove invalid input and unknown tool names invoke no handler/domain port.
- Exact-envelope tests cover success, each shared error family, warnings and mutually
  exclusive fields.
- Output-schema regressions reject `undefined`, invalid dates, extra fields and malformed
  nested data.
- Error-mapping tests prove safe Polish messages and bounded allowlisted details.
- Throwing-handler tests return `INTERNAL_ERROR` without stack/SQL/private payload leaks.
- Deterministic serialization tests cover Unicode, nullable fields and collection order.
- Direct non-LLM invocation and production build tests exercise the same executor.

## Consequences and trade-offs

- Adapters receive uniform safe results and handlers remain focused on application work.
- Output validation adds runtime cost, acceptable for a local single-campaign assistant.
- Stable error codes require deliberate maintenance but make tests and future provider
  adapters reliable.
- Redaction reduces immediate diagnostics in user results; injected local diagnostics
  can preserve safe operational evidence later.

## Implementation evidence

- `schemas/tool-outputs` publishes one normative output-data schema for each of the 13
  executable read/analysis tools. Shared definitions remain JSON Schema artifacts, and
  every public output root has a strict Zod mirror, inferred TypeScript DTO and parity
  entry.
- `src/tools/execution` owns the provider-neutral asynchronous executor. Its fixed path
  is strict input parsing, an optional neutral `beforeInvoke` hook, handler invocation,
  strict output-data parsing and final `ToolResult` validation.
- Invalid input returns `INVALID_TOOL_INPUT` before the hook or handler. Invalid or
  non-JSON output returns `TOOL_OUTPUT_INVALID`; unexpected throws and rejections return
  a redacted `INTERNAL_ERROR`.
- Failure factories bound Polish messages, warnings and allowlisted detail structures.
  The optional local observer receives only tool name, execution stage, code and an
  unexpected flag; observer failure cannot alter the public result. Adapter error
  mappers run inside the same containment boundary, so a mapper exception also becomes
  a redacted `INTERNAL_ERROR` envelope. Exceptions raised while evaluating an output
  schema—including throwing refinements or getters—are contained the same way.
- `ReadToolRegistry` remains limited to its 13 read/analysis bindings. Known runners and
  its read-only name dispatch return validated envelopes; an unknown name returns
  `TOOL_NOT_FOUND` and cannot reach a handler.
- Focused executor, schema parity, direct registry and M3 inspection regressions passed
  5 files / 143 tests. Scoped formatting, ESLint and strict TypeScript typecheck passed.

## Rejected alternatives

- Handler-specific envelopes are rejected because they drift and duplicate security
  policy.
- Escaping expected Zod/domain exceptions is rejected because callers would need unsafe
  exception introspection.
- CLI envelope reuse is rejected as cross-layer coupling.
- Returning partial success after output validation failure is rejected because callers
  cannot trust the data.

## Unresolved questions

None blocking. A provider may impose stricter schema subsets later; that adapter must
not weaken the canonical tool validation semantics.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-09-01.
- Approval scope: the complete ADR-0032 proposal without requested changes.

## Change log

- 2026-09-01 — Initial M4 proposal.
- 2026-09-01 — Accepted after explicit repository-owner approval.
- 2026-09-01 — Implemented normative read/analysis output DTOs, the shared safe
  executor, result factories, bounded diagnostics and envelope-returning read registry.
- 2026-09-09 — After owner-authorized current-head review remediation, contained
  exceptions thrown by injected error mappers and added precondition/handler regressions.
- 2026-09-09 — Contained exceptions raised by output-schema evaluation and added
  regressions for throwing refinements and getters.
