# ADR-0021: Deterministic import normalization and reconciliation

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

## Context and problem statement

The legacy tracker uses Polish human labels, nullable cells and compact combined
views. The M1 database uses explicit enum values, separate definitions and
assignments, separate base attributes and permanent modifiers, and separate inventory
and equipment rows. Matching only by a lower-cased name could merge distinct game
entities, while treating every source row as new would duplicate the campaign on the
second import.

M2 also requires a reconciliation file for uncertain fields. That file must make
human decisions explicit without becoming an unrestricted patch format or a route for
unverified English aliases into canonical state.

## Decision drivers and invariants

- Exact Polish display text is preserved and never replaced by a normalized key.
- Unknown stays `NULL`; `DO WERYFIKACJI` remains unverified.
- No translation, fuzzy match, web lookup or invented English alias is part of M2.
- Identical definitions merge only under explicit, testable rules.
- Multiple plausible matches produce ambiguity, not an arbitrary winner.
- Existing non-null canonical facts are never silently overwritten by import.
- Reconciliation decisions must be tied to the exact workbook and source record that
  produced them.
- Lae'zel's permanent +2 Strength must remain separate from base Strength and preserve
  `Mikstura Wiecznego Wigoru` as source provenance.

## Considered options

### Option A — Exact typed matching plus a digest-bound reconciliation document

Use deterministic matching keys per entity, classify every source fact, and emit a
versioned JSON reconciliation document for only the decisions that cannot be made
from approved rules.

### Option B — Match every entity by normalized Polish name

This is simple but violates the valid-collision rule for item, spell, ability and power
definitions.

### Option C — Fuzzy matching and automatic English-name research

This belongs to M7/M8, expands network and model scope, and risks silently selecting
the wrong localized entity.

### Option D — Always insert and rely on database uniqueness

Most definition names are intentionally not unique. The result would contain
duplicates even when the same tracker is imported twice.

### Option E — Let a reconciliation file contain arbitrary target rows

This would bypass typed domain services and turn a generated file into a second
writable database interface.

## Proposed decision and rationale

Select Option A.

### Exact text and normalization

Every original Polish display value is retained byte-for-byte after XLSX string
decoding. A separate matching key may be computed only as follows:

1. Unicode NFC normalization;
2. trim leading and trailing Unicode whitespace;
3. collapse internal whitespace runs to one ASCII space;
4. locale-explicit Polish lower-casing;
5. preserve diacritics, punctuation, apostrophes and word order.

Normalization never changes a stored display field. Blank required text is an error;
blank optional cells become `NULL`. Numeric and boolean cells must have the expected
cell type or an exact allow-listed legacy token; permissive JavaScript coercion is not
used.

### Closed legacy mappings

Legacy values are converted through checked, exhaustive dictionaries. Examples
include:

- `TAK`/`NIE` to booleans;
- the five tracker item statuses to M1 inventory statuses;
- Polish equipment positions such as `Pierścień 1` to `RING_1`;
- ability labels such as `Atut`, `Mistyczna Inwokacja`, `Manewr`, `Pakt`, `Sztuczka`
  and `Cecha klasowa` to M1 ability types;
- spell-source labels to the existing M1 source enum;
- `DO WERYFIKACJI` and `CZĘŚCIOWO POTWIERDZONE` to `UNVERIFIED`, preserving the
  exact legacy label in provenance/notes;
- the confirmed legacy labels to `VERIFIED`, preserving the exact label as the
  verification source.

An unknown token is never normalized to the nearest known token. It becomes an
ambiguous reconciliation entry.

### Entity identity and duplicate rules

Matching is entity-specific:

- Character identity uses the exact non-empty legacy `ID` as `canonical_name`; the
  Polish `Postać` cell becomes exact `display_name_pl`. Two different IDs may not
  share one display name in a single import: such input is a blocking ambiguity before
  any owner or capability reference is resolved.
- Item definitions use a deterministic fingerprint over the exact material source
  facts: preserved Polish name, mapped definition slot/type, nullable rarity,
  verification status and ordered imported effect text. A fingerprint is a matching
  aid, not a user-facing identity. Same normalized name with a different fingerprint
  remains a distinct candidate or conflict.
- Spells match by exact Polish name plus level. Abilities match by exact Polish name
  plus mapped type. Illithid powers match by exact Polish name plus any known tier.
  More than one database candidate is ambiguous.
- Character assignments match their existing composite identities, including the
  exact mapped source.
- An illithid power status belongs to its character row, not to the shared power
  definition. `WYKUPIONA` creates an assignment with preserved acquisition source;
  available and blocked rows may still establish the named definition without
  colliding with another character's status.
- For this legacy tracker, one `Przedmioty` row denotes one catalog definition and one
  inventory record unless explicit quantity data is present. The current workbook has
  188 distinct item names and no quantity column. A second same-definition row may be
  merged only if every material definition and placement field is identical; otherwise
  it is ambiguous/conflicting. Equipped inventory rows always have quantity one.
- `Wyposażenie` and the equipped rows in `Przedmioty` are two views of one aggregate.
  They must agree on character, item and slot before any placement is planned.

Exact existing canonical facts are `matched`. An absent identity can be `inserted`.
An identity match with an incompatible non-null fact is a `conflict`; import never
updates or clears it. A candidate set with no unique exact choice is `ambiguous`.

### Derived and special legacy semantics

- Current Strength is derived and must equal base Strength plus active permanent
  modifiers.
- A non-zero permanent Strength bonus requires an unambiguous source in the same
  character row/notes under a deterministic syntax. The current Lae'zel row yields an
  active permanent `ATTRIBUTE/STR +2` modifier with `source_name_pl = Mikstura
  Wiecznego Wigoru`, `provenance_type = IMPORT`, and preserved source locator/notes.
  Failure to extract a source is a blocking conflict, never a generic `IMPORT`
  placeholder.
- `DO WERYFIKACJI` imports the known identity/status while leaving unknown effects and
  rarity `NULL` and the definition `UNVERIFIED`.
- A nonblank legacy `Alias EN` has no independent verification metadata. It is not
  imported automatically; it requires an explicit verified-alias reconciliation
  decision or remains unresolved. The current tracker contains no aliases.
- Illithid `WYKUPIONA` rows create assignments. Named available/blocked rows may create
  unassigned definitions. Placeholder `—` plus `BRAK MOCY` creates nothing and is
  reported as skipped.

### Reconciliation document

Emit `BG3_IMPORT_RECONCILIATION_V1` JSON containing:

- exact format/version;
- SHA-256 of the source workbook bytes and detected workbook profile;
- deterministic issue ID and source locator;
- entity kind and bounded raw candidate facts;
- issue category and candidate canonical IDs when applicable;
- an initially empty resolution field whose allowed discriminated-union choices are
  limited to `select_existing`, `treat_as_new`, `provide_canonical_value`,
  `attest_verified_alias` or `skip` as applicable to that issue type.

The importer validates the document strictly. It rejects duplicate issue IDs, unknown
fields/actions, stale workbook digests, invalid target IDs and resolutions that try to
change unrelated fields. Reconciliation input only resolves the staged source fact;
it still passes the same domain validation and transactional service as automatic
facts.

A duplicate character display name cannot be resolved by patching or skipping only
one staged character row. The ambiguity also affects owner and capability references
elsewhere in the workbook, so the source tracker and all dependent references must be
corrected together before a new digest-bound import is planned.

## Boundaries and dependency direction

- Pure normalization, mapping, fingerprint and reconciliation-schema functions live
  outside persistence and are deterministic under injected configuration.
- Candidate lookup uses read-only repository ports.
- Reconciliation may reference canonical IDs returned by read ports, but cannot call
  write repositories.
- The output is a typed import plan consumed by ADR-0022; the XLSX adapter cannot
  apply database changes itself.
- Item resolver, external research and model code are not dependencies of M2.

## Data, migration and compatibility impact

- No schema migration is proposed.
- M2 may populate the existing nullable `item_definitions.fingerprint` for definitions
  it creates. The fingerprint algorithm receives a version prefix so a future policy
  can coexist without rewriting older values.
- Existing rows are matched but never updated by the importer.
- Reconciliation files are private generated artifacts, not canonical state and not
  committed by default. Their sole authority is a validated decision for the exact
  source digest during an explicit import invocation.
- Changing normalization, fingerprint or reconciliation semantics requires a version
  change and compatibility tests; old keys must not be silently reinterpreted.

## Transaction, validation, audit and rollback impact

Normalization, lookup and reconciliation planning are read-only. They create no audit
events. A resolution becomes canonical only when the final import plan commits under
ADR-0022.

Any stale or invalid reconciliation entry fails before the mutation transaction. A
domain invariant failure during application rolls back the complete plan and its audit
event.

## Security, privacy and external-data impact

- Raw workbook and reconciliation text is data, never executable code or prompting.
- Reports and reconciliation files are private and ignored by Git by default.
- Raw values in errors are length-bounded; no full workbook, snapshot or SQL is logged.
- `attest_verified_alias` is an explicit user-authored assertion recorded with source
  location; M2 performs no web lookup.
- Digests provide stale-input detection, not confidentiality or authorship.

## Required tests and operational evidence

- Golden normalization tests cover Polish diacritics, composed/decomposed Unicode,
  apostrophes, whitespace and punctuation without modifying display text.
- Exhaustive mapping tests cover every distinct legacy status, slot, verification,
  ability type and spell source present in the real tracker.
- Unknown tokens produce ambiguity and zero writes.
- Identical item rows merge only under the exact rule; same name with different
  rarity/effect/slot remains distinct or conflicting.
- Multiple exact database candidates produce ambiguity rather than first-row choice.
- Existing incompatible non-null facts produce conflict and are unchanged.
- `DO WERYFIKACJI` round-trips as `UNVERIFIED` with unknown fields still `NULL`.
- Blank English aliases remain `NULL`; nonblank unattested aliases do not import.
- Lae'zel's base Strength 20, permanent +2 modifier, source name, `IMPORT` provenance
  and derived Strength 22 are asserted directly.
- Equipment and inventory cross-view mismatch blocks the affected plan.
- Reconciliation schema, stale digest, invalid target/action and successful explicit
  resolution paths are covered.

## Consequences and trade-offs

- Idempotency is based on explicit semantic identity rather than worksheet row order.
- The importer is conservative when an existing database has been edited after the
  source workbook; it reports a conflict instead of using import as synchronization.
- A versioned reconciliation document provides a reviewable human decision point, but
  adds an extra step for genuinely ambiguous data.
- Locale-explicit normalization improves matching but is never treated as proof of
  identity.
- M2 does not gain fuzzy Polish/English resolution; that capability remains correctly
  deferred to M7/M8.

## Rejected alternatives

- Name-only and row-number identity are rejected as unstable or collision-prone.
- Upsert-overwrite behavior is rejected because it can erase newer canonical facts.
- Importing effective attributes is rejected because they are derived.
- Generic modifier provenance such as `spreadsheet` is rejected when the actual source
  is required and available.
- Free-form reconciliation patches are rejected as an arbitrary write escape hatch.

## Unresolved questions

None blocking. The exact allow-listed legacy token tables may grow only when a new
observed token has an unambiguous domain meaning; any semantic change requires ADR
review.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-28.
- Approval scope: the complete ADR-0021 proposal without requested changes.

## Change log

- 2026-08-28 — Initial M2 proposal based on the actual workbook value domains and M1
  identity/invariant model.
- 2026-08-28 — Accepted after explicit repository-owner approval.
- 2026-08-29 — Implemented deterministic normalizers, entity-specific fingerprints,
  complete report/reconciliation artifacts and private acceptance with zero ambiguous
  or conflicting facts in the supplied tracker.
- 2026-08-29 — Applied review hardening: strictly validated digest-bound decisions now
  transform only their staged source field or conservative planner outcome, and
  inapplicable, stale, fabricated-target or unrelated decisions are rejected.
- 2026-08-29 — Added review regression coverage for conflicting composite assignments
  already pending in one plan, classifying them before persistence instead of relying
  on a SQLite constraint failure.
- 2026-08-29 — Preserved each aggregated assignment's original row in reports and
  reconciliation decisions, matched illithid prerequisites by their full composite
  identity and mapped sold legacy inventory to an ownerless placement.
- 2026-08-29 — Compared equipment conflicts with both persisted and pending slot
  assignments; resolving a collision by retaining or skipping the occupant now also
  removes any dependent newly planned `EQUIPPED` inventory row.
- 2026-08-29 — Rejected duplicate character display names before reference lookup and
  moved legacy illithid status from shared definition identity to acquired-character
  assignment semantics.
- 2026-08-30 — Refused row-local reconciliation of duplicate character display names;
  this ambiguity requires a consistent source-workbook correction including dependent
  owner and capability references.
