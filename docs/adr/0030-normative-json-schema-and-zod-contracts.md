# ADR-0030: Normative JSON Schema and executable Zod tool contracts

Status: Accepted

Milestone: M4 — Typed Tool Layer

## Context and problem statement

The repository already contains normative JSON Schema design artifacts under
`schemas/domain` and `schemas/tools`, while the runtime uses TypeScript and already
depends on Zod. M4 requires executable Zod schemas corresponding to the JSON artifacts.
Maintaining two unrelated handwritten definitions would allow accepted tool input to
differ between documentation, model adapters and direct test callers.

The tool manifest is a roadmap-level capability inventory. Its README explicitly allows
individual tool schemas to be added incrementally, so presence in the manifest cannot
by itself mean that a capability is executable in M4.

## Decision drivers and invariants

- Invalid input must be rejected before a domain or persistence dependency is called.
- Tool contracts must remain independent of OpenAI and callable with plain TypeScript.
- JSON Schema remains useful to non-TypeScript adapters and model-provider integrations.
- Runtime validation must use the same field names, requiredness, enums, bounds and
  unknown-key policy as the published JSON artifact.
- Validation must not coerce, guess, normalize away Polish display text or apply
  undocumented defaults.
- Later-milestone tools must not become executable merely because their names occur in
  the manifest.
- M4 must not add a runtime schema-conversion dependency unless existing Zod support is
  demonstrably insufficient and a new ADR is approved.

## Considered options

### Option A — JSON Schema is normative; handwritten Zod mirrors are parity-tested

Keep reviewable JSON artifacts as the public design contract, implement strict Zod
counterparts, and verify both from one shared positive/negative fixture matrix plus
explicit structural assertions.

### Option B — Make Zod authoritative and generate all JSON Schema

This removes most duplication, but Zod generation does not necessarily preserve the
existing external document organization, relative references, titles and all JSON
Schema semantics without changing the published artifacts.

### Option C — Compile JSON Schema at runtime

This gives one source but requires a new validator/runtime dependency and weakens
inferred TypeScript ergonomics unless code generation is added.

### Option D — Maintain both forms without a parity gate (status quo)

This is the status quo implied by the files and does not prevent silent drift.

## Proposed decision and rationale

Select Option A.

JSON Schema files remain the normative serialized contract. Every M4-active domain or
tool schema receives an explicitly exported strict Zod counterpart and an inferred
TypeScript input/output type. Both forms must be changed together in one reviewed diff.

M4 will add the missing individual schemas needed by its active read and deterministic
analysis tools, and the mutation/proposal contract shapes governed by ADR-0033. It will
not add individual schemas for research, item resolution, merchant sessions or other
later workflow behavior solely to make the roadmap manifest look complete. An existing
later-milestone schema may receive a Zod mirror and parity coverage as a contract
artifact, but it is not thereby registered as executable.

Parity evidence will use a checked-in, sanitized matrix for every paired schema:

- minimum valid input and fully populated valid input;
- missing required fields;
- wrong primitive and enum values;
- boundary values;
- additional properties at every object boundary;
- both confirmation variants and invalid mixtures;
- Unicode/Polish text, blank values and explicit `null` where relevant.

The test must identify every `*.schema.json`/Zod pair and fail when either side lacks a
declared counterpart. Structural assertions cover required fields, enum members,
bounds, defaults and `additionalProperties: false`; fixture validation covers the
accepted/rejected behavior. If parity cannot be expressed without weakening either
contract, implementation pauses for an ADR revision instead of choosing one silently.

Zod parsing uses strict, non-coercing schemas. Defaults are applied only when the JSON
Schema documents the same default. Input parsing returns a new validated value and
does not mutate the caller's object. Canonical Polish strings are preserved exactly;
matching normalization remains an application-service concern.

## Boundaries and dependency direction

- `schemas/**` owns normative serialized contracts.
- A new tool-contract module owns Zod mirrors and inferred transport DTO types.
- Tool execution depends on those schemas; schemas do not import handlers, SQLite,
  repositories, OpenAI SDKs or CLI adapters.
- Domain/application services continue to own semantic validation and invariants after
  boundary validation succeeds.
- Provider-specific schema conversion is a future adapter concern and may consume the
  normative JSON artifacts without becoming their owner.

## Data, migration and compatibility impact

- No SQLite schema, migration or canonical campaign data change is proposed.
- Existing JSON Schema field names remain snake_case and are not silently renamed to
  internal camelCase.
- Contract tightening discovered during M4 must update both forms and be documented;
  it is a pre-1.0 contract change, not an implicit parser difference.
- The tool manifest remains a capability inventory, not an executable-registry file.

## Transaction, validation, audit and rollback impact

- Schema validation occurs before handler invocation and therefore before any campaign
  transaction, snapshot or audit event.
- Invalid input creates no canonical write and no audit event.
- Zod validation complements rather than replaces domain validation inside the M1
  transaction coordinator.
- Rolling back this documentation proposal changes no data; later contract rollback is
  a code/artifact revert with no database migration.

## Security, privacy and external-data impact

- Strict objects reject smuggled fields and reduce accidental capability expansion.
- Validation diagnostics must be bounded and must not echo whole private payloads.
- Schemas perform no network access and treat research-like fields as untrusted data.
- Sanitized fixtures must not contain the user's real campaign state.

## Required tests and operational evidence

- Pair-discovery test for every M4-governed JSON/Zod schema.
- Shared acceptance/rejection corpus executed against both representations.
- Tests prove strict unknown-key rejection, no coercion and no caller-object mutation.
- Tests prove invalid input does not invoke a spy handler or open a database.
- Contract snapshots/diffs make enum, required-field and bound changes reviewable.
- `pnpm check` and production build pass without a new runtime dependency.

## Implementation evidence

- `src/tools/contracts` provides strict non-coercing Zod mirrors and inferred
  TypeScript types for all five domain schemas and all 25 individual tool-input schemas.
- `CONTRACT_SCHEMA_PAIRS` is the explicit drift boundary. Pair-discovery coverage scans
  `schemas/domain` and `schemas/tools` and fails for a missing, duplicate or undeclared
  `*.schema.json` counterpart.
- Missing read, deterministic-analysis and mutation input JSON Schemas were added. The
  future `resolve_item_identity` schema remains a paired but non-executable contract
  artifact; registration and availability remain governed by ADR-0031.
- Confirmation is now an exclusive `oneOf`: a non-blank proposal ID or a literal direct
  fact with non-blank source utterance. Tool text identifiers use matching non-blank
  constraints in JSON and Zod.
- A dependency-free test validator exercises the normative JSON artifacts and each Zod
  mirror with generated minimum-valid and top-level negative corpora. Focused tests also
  cover confirmation exclusivity, documented defaults, no coercion, no caller-input
  mutation and no downstream call after failed validation.
- Focused verification passed 1 file / 64 tests and strict TypeScript typecheck passed.
  No runtime dependency was added.

## Consequences and trade-offs

- JSON remains portable and human-reviewable while Zod provides runtime validation and
  inferred TypeScript types.
- Handwritten mirrors require discipline and a substantive parity suite.
- Fixture parity is more maintenance than one generated source, but avoids publishing a
  materially reformatted or semantically altered schema set in M4.
- Future adoption of generation remains possible through a superseding ADR.

## Rejected alternatives

- Unchecked dual maintenance is rejected because it cannot satisfy stable contracts.
- Runtime JSON Schema compilation is rejected for M4 because it adds dependency and
  type-generation complexity without a demonstrated need.
- Treating every manifest name as implemented is rejected because it would pull M6–M9
  and M14 behavior into M4.
- Coercive parsing is rejected because model or adapter mistakes must fail visibly.

## Unresolved questions

None blocking. Cosmetic JSON formatting and `$id` placement may be normalized if the
semantic parity tests and external reference paths remain stable.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-09-01.
- Approval scope: the complete ADR-0030 proposal without requested changes.

## Change log

- 2026-09-01 — Initial M4 proposal.
- 2026-09-01 — Accepted after explicit repository-owner approval.
- 2026-09-01 — Implemented 30 normative JSON/Zod schema pairs, pair discovery and the
  shared semantic parity corpus; focused tests passed 64/64.
