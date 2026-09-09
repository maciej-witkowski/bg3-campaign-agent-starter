# ADR-0031: Capability-separated tool catalog and executable registries

Status: Accepted

Milestone: M4 — Typed Tool Layer

## Context and problem statement

M4 must introduce a tool registry while preserving a stronger guarantee: a read-only
caller must be unable to discover or invoke mutation capabilities through the object it
receives. A single registry with category metadata would still let accidental string
dispatch reach a mutation handler. Conversely, the existing manifest includes future
research, merchant and mutation workflows that are not implemented in M4.

The M3 inspection service already provides conservative read projections and a
read-only SQLite composition. M4 should adapt those application boundaries rather than
move query semantics into tool handlers or expose the M3 CLI/process contract.

## Decision drivers and invariants

- Read-only and mutation capability separation must be structural, not a caller flag.
- Tool contracts must execute in tests without an LLM or provider SDK.
- Models, UI and adapters must never receive SQLite, Drizzle or generic repository
  access.
- Tool names and categories must be unique, deterministic and reviewable.
- Registration must fail closed for duplicate names, schema/handler mismatches and
  undeclared capabilities.
- M4 must not implement proposal storage, confirmation resolution, item resolution,
  research providers, merchant sessions or M14 heuristic scoring.
- Recommendations and deterministic analysis remain non-mutating.

## Considered options

### Option A — Immutable catalog plus separately constructed capability registries

Define metadata/contracts centrally, then build distinct read/analysis, proposal and
mutation registries whose public types expose only their allowed invocation methods.

### Option B — One registry with a `category` field checked at invocation

This is simple, but any consumer holding the registry still holds mutation dispatch and
depends on every runtime check being correct.

### Option C — One class per tool with no catalog

This separates handlers but makes name uniqueness, discovery, provider export and
contract coverage ad hoc.

### Option D — Reuse CLI command dispatch as the tool registry

The CLI contract is process-oriented, omits several tool views and includes export; it
is not the stable application tool boundary.

### Option E — Keep the repository without an executable tool registry (status quo)

This avoids new abstractions but does not deliver M4 and leaves future adapters without
an enforceable typed capability boundary.

## Proposed decision and rationale

Select Option A.

Introduce an immutable `ToolCatalog` containing definition metadata only: canonical
snake_case name, category, Polish description, input schema, output-data schema,
milestone ownership and availability. It contains no database or handler references.
The existing `tool-manifest.json` remains the roadmap inventory; executable entries are
only those with an individual approved contract and an explicitly supplied handler.

Build separate registries:

- `ReadToolRegistry` for `read` and deterministic `analysis` definitions only;
- `ProposalToolRegistry` for proposal construction contracts, with no canonical store;
- `MutationToolRegistry` for mutation definitions and the ADR-0033 authorization gate.

There is no public registry union and no `invoke(name)` method that spans these three
capability sets. A composition root must choose which registry object to hand to a
caller. In particular, M5 may receive only `ReadToolRegistry`; adding mutation exposure
there would be a type/composition change visible in review.

M4 implements read and deterministic-analysis handlers over application ports, reusing
M3 query/validation semantics where applicable. The intended active surface is:

- read: `get_party`, `get_character`, `get_character_build`,
  `get_character_equipment`, `find_inventory_items`, `get_item`,
  `get_character_spells`, `get_illithid_state`, `get_recent_changes`;
- analysis: `compare_equipment`, `calculate_effective_attributes`,
  `find_equipment_candidates`, `validate_campaign_state`.

`compare_equipment` only assembles deterministic recorded facts and opportunity-cost
inputs; it does not issue the final recommendation. `find_equipment_candidates` uses
only explicit existing slots/effect facets and requested exact filters. It does not
invent M14 tags or scores. Ambiguous item/character identity fails closed under current
conservative Polish matching; M7 fuzzy resolution is not imported.

Proposal and mutation definitions are registered only in their dedicated registries.
M4 may exercise them with injected fake/application handler ports to prove the contract
and boundary, but the production campaign composition will not wire concrete proposal
storage, confirmation resolution or the M6 high-level mutation workflows. An absent
handler is represented as unavailable during registry construction/export, not as a
late call into placeholder domain behavior.

Research (`resolve_item_identity`, `verify_item_effects`) and temporary workflow names
remain catalogued roadmap capabilities but are not executable M4 entries. Their later
milestones must supply approved contracts and handlers.

## Boundaries and dependency direction

- Catalog/contracts are pure and depend only on schema/value definitions.
- Registries depend on catalog definitions and narrow handler ports.
- Read/analysis handlers depend on application query/validation services, never on CLI
  parsing/rendering or persistence implementations.
- Concrete composition injects SQLite-backed application ports below the tool layer.
- Mutation handler ports point toward typed domain/application services and can only be
  reached through the dedicated authorized registry.
- Provider adapters may translate an allowed registry to provider function definitions;
  this is not implemented until the relevant agent milestone.

## Data, migration and compatibility impact

- No database migration or canonical-state change is proposed.
- M3 CLI envelopes and commands remain unchanged; tools receive their own contracts.
- Tool names are stable identifiers. Renaming or recategorizing one is a breaking tool
  contract change requiring explicit documentation and tests.
- Manifest entries for later milestones remain non-executable inventory.

## Transaction, validation, audit and rollback impact

- Read/analysis registries cannot reach the mutation coordinator and create no audit
  events.
- Compound reads continue to use transactionally consistent application read ports.
- M4 does not change M1 transaction, validation, snapshot or audit ordering.
- Concrete mutations, when added in M6, must still delegate to ADR-0014 services.

## Security, privacy and external-data impact

- Least-capability composition prevents accidental mutation exposure to a read-only
  model or adapter.
- Catalog enumeration contains descriptions and schemas, never campaign values.
- Tool handlers return bounded requested projections rather than raw database handles or
  full-state dumps.
- No network access or external provider SDK is introduced.

## Required tests and operational evidence

- Compile-time/API tests and runtime shape tests prove the read registry has no mutation
  lookup or invocation surface.
- Registry construction rejects duplicate names, category mismatch, missing schema and
  undeclared handlers.
- Every active read/analysis tool is called directly in tests without an LLM.
- Integration tests prove read/analysis calls leave database bytes and audit rows
  unchanged.
- Query regressions cover not-found, ambiguous and inconsistent canonical state.
- Catalog/manifest coverage distinguishes executable M4 entries from future inventory.
- Public package exports contain no raw connection, repository or generic all-category
  dispatch capability.

## Consequences and trade-offs

- Capability separation is explicit at composition and review time.
- Multiple registry types add modest wiring compared with one dictionary.
- Reusing application services prevents tool/CLI semantic drift but may require small
  new query DTOs for tool-specific projections.
- The manifest can describe the long-term product without falsely advertising current
  runtime availability.

## Implementation evidence

- `src/tools/catalog/read-tool-catalog.ts` defines and freezes the deterministic M4
  catalog of exactly nine read and four analysis capabilities. Its construction guard
  rejects duplicate names, unsupported categories and missing schemas; roadmap-only
  manifest capabilities are not executable.
- `ReadToolRegistry` exposes only `list()` and read/analysis `get()` bindings. It has no
  mutation, proposal or all-category dispatch surface. Each minimal runner validates
  input before calling its narrow application handler and validates the returned
  JSON-safe DTO; stable envelopes and exception mapping remain ADR-0032 work.
- `CampaignReadToolService` adapts the M3 inspection and validation boundaries. Each
  compound inspection captures all required rows in one read transaction and performs
  its joins and comparisons against that immutable in-memory projection.
- `openM4CampaignApplication` opens SQLite read-only and exposes exactly the read tool
  registry and `close`; it wires no exporter, mutation coordinator or authorization
  issuer.
- Focused tests call all 13 tools without an LLM, cover catalog/manifest separation,
  fail-closed construction, invalid-input-before-handler behavior, conservative
  missing/ambiguous character resolution and prove byte-identical SQLite plus an
  unchanged audit-row count.
- Ability and spell projections preserve definition verification status. Automatic
  equipment candidates exclude another character's protected `PERSONAL_STORY` items
  because M4 exposes no explicit redistribution permission.

## Rejected alternatives

- A category flag on one all-powerful registry is rejected as an accidental-call risk.
- Reusing CLI dispatch is rejected because process semantics are not application tool
  semantics.
- Placeholder handlers that return invented or partial game facts are rejected.
- M7 fuzzy matching, M8 research and M14 scoring are rejected from M4 scope.

## Unresolved questions

None blocking. Provider-facing descriptions may be refined later without changing tool
identity, input/output schemas or capability membership.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-09-01.
- Approval scope: the complete ADR-0031 proposal without requested changes.

## Change log

- 2026-09-01 — Initial M4 proposal.
- 2026-09-01 — Accepted after explicit repository-owner approval.
- 2026-09-01 — Implemented the read/analysis catalog, registry, atomic query adapter,
  JSON-safe DTOs and read-only M4 composition; focused tests passed 4/4.
- 2026-09-09 — After owner-authorized Codex review remediation, preserved ability/spell
  verification metadata and protected character-bound story items from automatic
  redistribution candidates.
