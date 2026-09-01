# ADR-0027: M3 CLI query semantics and read projections

Status: Accepted

Milestone: M3 — Read-Only CLI

## Context and problem statement

The M3 roadmap names nine commands but does not define their precise lookup rules,
projection boundaries, ordering or filter semantics. The current M1 read repository is
aggregate-oriented and primarily looks up records by internal ID. A CLI needs joined,
human-meaningful views without leaking persistence rows or duplicating business
calculations in its renderer.

One scope mismatch needs an explicit decision: `inventory --tag` is required by M3,
while the current schema has no generic tag relation. M14 deliberately owns a later
synergy taxonomy. M3 must make the option useful without inventing inferred facts,
adding a speculative schema or presenting M14-style tags as canonical data.

## Decision drivers and invariants

- Queries read canonical SQLite state and preserve Polish display text and unknowns.
- Character lookup must be convenient but deterministic; ambiguity must fail rather
  than select an arbitrary row.
- Effective attributes are derived from base values and active permanent modifiers.
- Inventory definition, owned instance, equipment assignment and effects remain
  distinct facts in the output.
- Stable JSON requires deterministic row ordering and explicit `null` values.
- The CLI must not infer spell availability, illithid availability or item synergy that
  is not represented in M1/M2 state.
- M3 must not add alias resolution, fuzzy matching, generic tags or scoring from M7/M14.
- Query and rendering contracts must remain reusable without coupling M3 to the M4 tool
  registry.

## Considered options

### Option A — Typed, command-specific application query projections

Define immutable DTOs and application query methods for each M3 view. Resolve names
centrally, join data in a persistence adapter and render the same DTO as human text or
JSON.

### Option B — Render raw snapshot collections in every command

This reuses one payload, but forces the adapter to perform joins and domain derivations,
returns excessive data and couples users to storage-shaped records.

### Option C — Extend the M1 aggregate repository until it is a general query API

This blurs entity lookup with application views and risks exporting a large low-level
surface that later adapters could misuse.

### Option D — Use free-form SQL templates in the CLI

This is concise but violates the typed boundary and makes output and authorization hard
to review.

### Option E — Add a persisted M14 tag taxonomy now

This would require an unrequested schema migration and pre-decide later synergy-engine
semantics.

### Option F — Accept `--tag` but always reject it as unsupported

This avoids guessing, but fails a named M3 command capability and provides no useful
filter over already structured effect facets.

## Proposed decision and rationale

Select Option A. Add a persistence-agnostic M3 inspection service with command-specific
immutable result DTOs. Its SQLite adapter performs bounded, parameterized projections
and returns all collections in a documented deterministic order. Human and JSON
renderers consume the same DTO and do not issue further queries.

### Character resolution

For `character`, `equipment`, `spells` and character-scoped `illithid`:

1. trim the supplied name and normalize it to NFC;
2. try an exact case-sensitive `canonical_name` match;
3. otherwise compare a Polish matching key (NFC, trimmed, internal whitespace
   collapsed, Polish-locale lowercase) against `display_name_pl`;
4. return `CHARACTER_NOT_FOUND` for zero matches;
5. return `CHARACTER_AMBIGUOUS` with safe candidate identifiers for multiple matches.

No substring, diacritic-stripping, English alias or fuzzy resolution is allowed in M3.
Canonical-name precedence is safe because it is unique by schema.

### Command projections

- `party` returns active characters only, including identity, Polish display name,
  class/subclass, level, role and effective attributes. Rows sort by Polish display
  name and then stable ID.
- `character <name>` returns the canonical profile, base/effective attributes,
  permanent modifiers and assigned abilities. It does not silently expand into the
  dedicated equipment, spell or illithid views.
- `equipment <name>` returns one row per occupied slot joined to its owned instance,
  item definition and effects. It does not invent empty-slot item records. Rows use
  the fixed equipment-slot order from the domain value set, then stable instance ID.
- `inventory` returns owned instances joined to definitions and effects. Repeated
  filter values use AND across filter categories and OR within one category. Rows sort
  by status, Polish item name, owner, slot and stable instance ID.
- `spells <name>` returns the character's recorded assignments joined to spell
  definitions, preserving source, known, prepared and always-prepared independently.
  Rows sort by spell level, Polish name, source and stable ID.
- `illithid` without a name returns recorded power definitions plus prerequisite edges.
  With a character name it additionally returns that character's recorded acquisitions.
  Missing acquisitions are not labelled available or blocked unless a future approved
  model stores those facts. Rows sort by tier with `null` last, Polish name and ID.
- `changes` returns append-only audit summaries newest first, with a deterministic ID
  tie-breaker. It defaults to 20 rows and accepts a positive `--limit` no greater than
  1000. Full before/after snapshot JSON is excluded from the default projection to
  avoid dumping private state and unbounded payloads.
- `validate` returns the existing deterministic campaign-validation violations in
  validator order plus a boolean validity summary. It does not repair state.
- `export` delegates to the existing versioned M2 export service as specified by
  ADR-0026 and does not define a second campaign projection.

### Inventory filters

- `--slot` accepts the existing item-definition slot enum and compares it exactly.
- `--status` accepts the existing inventory-status enum and compares it exactly.
- Repeating `--slot`, `--status` or `--tag` means OR within that filter category.
- Different supplied categories combine with AND.
- Unknown enum values and blank tag values are input errors, not empty result sets.

For M3 only, a **tag facet** is an exact normalized non-null value already stored in an
associated `item_effects.effect_type`, `item_effects.damage_type` or
`item_effects.trigger` field. A supplied `--tag` is normalized with the same conservative
Polish matching-key function, and at least one supplied tag must match a facet of the
item definition. Description, notes and condition prose are not tokenized. M3 does
not persist, infer or return a canonical tag taxonomy. This provides a deterministic
filter over existing structured facts while leaving M14 free to introduce explicit
synergy tags through its own ADR and migration if needed.

### Unknown and inconsistent data

Optional unknown values remain explicit `null` in DTOs and display as a consistent
Polish unknown marker in human output. Query services do not repair conflicts. Except
for `validate`, a query may return stored facts even when an unrelated campaign
invariant is invalid; joined facts required by the requested view that are internally
inconsistent produce a typed query error rather than a fabricated row. Export continues
to refuse any invalid full state under ADR-0023.

## Boundaries and dependency direction

- The CLI adapter parses names and filters into typed application requests only.
- The application inspection service owns resolution rules, derivations and result DTOs.
- A dedicated read projection port is implemented by SQLite persistence with
  parameterized Drizzle queries.
- Effective-attribute calculation reuses domain logic; the renderer never recomputes it.
- DTOs contain domain values and public view fields, not Drizzle row types or SQL text.
- M4 may later adapt these application contracts, but M3 does not create a tool registry
  or claim that CLI JSON is an OpenAI tool contract.

## Data, migration and compatibility impact

- No schema migration, backfill or campaign-state change is proposed.
- Existing item-effect fields gain no new canonical meaning; they are only documented as
  exact read-time filter facets for this CLI option.
- No generic `tags` column/table, alias table, full-text index or materialized view is
  added.
- The projections are versioned externally by ADR-0028 and may evolve only under its
  compatibility rules.
- M14 may supersede the temporary facet definition for future CLI versions, but must not
  silently change M3 JSON semantics.

## Transaction, validation, audit and rollback impact

- Query assembly is read-only and creates no audit event.
- Compound views use one consistent read transaction as required by ADR-0026.
- Effective values are derived without persisting caches.
- Ambiguous names, invalid filters, dangling/inconsistent joined facts and validation
  violations result in explicit data/error output; none triggers repair or rollback.
- `changes` reads existing append-only audit rows and never deserializes snapshots unless
  a future explicit command requests it.

## Security, privacy and external-data impact

- All filters are typed values bound as query parameters; no user input is interpolated
  into SQL identifiers or statements.
- `changes` avoids exposing full before/after snapshots in normal output.
- Ambiguity errors disclose only local character identifiers and Polish display names
  needed to resolve the request.
- No network, model, external research or alias service is invoked.
- Query limits bound accidental terminal and JSON disclosure; inventory remains bounded
  by canonical local state and has no arbitrary SQL pagination input.

## Required tests and operational evidence

- Sanitized integration fixtures exercise every command projection and empty result.
- Character lookup tests cover canonical precedence, Polish case normalization, NFC,
  whitespace normalization, not-found and ambiguous display names.
- Attribute tests prove base plus only active permanent modifiers produces the effective
  values shown by `party` and `character`.
- Equipment tests cover slot order, joined definition/effects and an inconsistent join
  failure without mutation.
- Inventory tests cover each filter, repeated-filter OR, cross-category AND, combined
  filters, exact tag facets, multiple required tags, null facets and refusal to search
  prose as inferred tags.
- Spell tests preserve all recorded source and preparation flags without inference.
- Illithid tests preserve definitions, prerequisite edges and acquisitions while proving
  unrecorded availability/blocking is not invented.
- Change tests cover default, boundary and invalid limits, deterministic newest-first
  ordering and exclusion of snapshot payloads.
- Validation tests cover both valid and invalid state with unchanged database bytes/state.
- Contract tests prove deterministic ordering and explicit `null` preservation.

## Implementation evidence

- `CampaignInspectionService` owns character resolution, effective-attribute derivation,
  filter normalization, join integrity checks and deterministic result ordering over
  persistence-independent immutable DTOs.
- `SqliteCampaignInspectionReadPort` supplies a transaction-scoped typed read session;
  each compound command view is assembled in one consistent read transaction without
  exposing Drizzle or SQL to the application/CLI boundary.
- Character resolution applies exact canonical precedence followed by conservative
  NFC/Polish display-name matching and returns bounded not-found/ambiguity errors.
- Inventory facets use exact normalized `effect_type`, `damage_type` and `trigger`
  values, combine categories with AND and repeated values with OR, and never search
  description prose or infer M14 taxonomy.
- Change projections select summary columns only and apply the approved newest-first
  order and 1–1000 bound; before/after snapshots never enter the DTO.
- Illithid projections verify that every character acquisition and both endpoints of
  every prerequisite edge reference a returned power definition; dangling required
  joins return `INCONSISTENT_STATE`.
- Equipment projections reject assignments whose owned instance is not singly
  `EQUIPPED` by the assigned character or whose known definition slot is incompatible;
  slot compatibility is shared with the campaign validator. Inventory projections
  apply the same checks after filters whenever they include an equipment assignment,
  reject a returned `EQUIPPED` instance with no assignment, and reject returned `CHEST`
  or `SOLD` instances that retain an owner. Character equipment also rejects an owned
  `EQUIPPED` instance missing its assignment.
- The M3 composition exposes inspection, validation, the existing M2 exporter and
  `close()` only over the read-only ADR-0026 connection.
- Sanitized SQLite integration coverage exercises all query projections, Polish/NFC
  resolution, ambiguity/not-found, effective modifiers, join inconsistency, all filter
  rules, spell flags, illithid non-inference, audit bounds/order and explicit export
  isolation. The focused session passed 2 files / 12 tests plus strict typecheck/lint.

## Consequences and trade-offs

- Purpose-built views give callers useful, bounded results while keeping persistence
  details private.
- Some joins duplicate query code compared with returning one universal snapshot.
- Conservative character matching is less forgiving than fuzzy search, but prevents
  silently selecting the wrong campaign entity before M7 exists.
- The M3 tag facet is intentionally narrower than ordinary-language tags. It is useful
  for facts already structured in M1, but cannot find inferred concepts such as
  `radiant-orb` unless that exact facet is stored.
- Excluding full audit snapshots makes `changes` safe and compact but not a forensic
  diff viewer.

## Rejected alternatives

- Raw snapshots and storage rows are rejected as CLI view contracts because they leak
  internal representation and make adapters own business joins.
- Free-form SQL and arbitrary sort/filter expressions are rejected as unsafe escape
  hatches.
- Fuzzy or alias-based character resolution is rejected until the resolver milestone.
- Inferring tags from Polish descriptions is rejected because it would silently turn
  heuristic/model interpretation into apparent canonical facts.
- Adding M14's tag schema or synergy scoring in M3 is rejected as later-milestone scope.
- Treating a required `--tag` option as permanently unsupported is rejected because a
  precise read-only facet interpretation is available from existing data.

## Unresolved questions

None blocking. Human-friendly labels for effect facets may be refined in documentation
without changing their exact stored-value matching semantics or the JSON contract.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-30.
- Approval scope: the complete ADR-0027 proposal without requested changes.

## Change log

- 2026-08-30 — Initial M3 proposal.
- 2026-08-30 — Accepted after explicit repository-owner approval.
- 2026-08-30 — Implemented typed query DTOs/service, transaction-scoped SQLite read
  projections, conservative Polish resolution, deterministic filtering/ordering and
  the final read-only M3 composition.
- 2026-08-30 — After approved PR re-review remediation, corrected repeated tag facets
  to use the accepted OR-within-category rule and added a distinguishing regression.
- 2026-08-30 — After approved final re-review remediation, expanded equipment join
  integrity checks to reject contradictory status, owner, quantity and definition-slot
  facts with `INCONSISTENT_STATE` rather than rendering a misleading row.
- 2026-08-31 — After approved follow-up re-review remediation, applied the same required
  equipment-fact checks to assignments included by the inventory projection.
- 2026-08-31 — After approved subsequent re-review remediation, required assignments
  for returned `EQUIPPED` instances in both applicable views and moved inventory join
  validation after filters so unrelated excluded inconsistencies do not fail a query.
- 2026-08-31 — After approved later re-review remediation, rejected dangling illithid
  acquisition definitions and missing source/target definitions in prerequisite edges.
- 2026-08-31 — After approved inventory-owner remediation, rejected returned `CHEST`
  and `SOLD` rows with a non-null owner after applying inventory filters, while leaving
  excluded contradictory rows outside the requested projection.
