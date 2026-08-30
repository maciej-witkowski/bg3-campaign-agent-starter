# ADR-0025: Exact package-wide SpreadsheetML prefix normalization

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

Refines: ADR-0024 bounded OpenXML namespace compatibility

## Context and problem statement

ADR-0024 approved an in-memory compatibility shim for the known legacy tracker. Its
evidence correctly identified the `x:` SpreadsheetML prefix in `xl/workbook.xml`, but
the proposed transformation was too narrow: it prohibited changes to other XML parts.

Implementation proved that after normalizing `xl/workbook.xml`, ExcelJS reaches
`xl/sharedStrings.xml` and rejects its `x:sst` root. A read-only inventory of the same
tracker found the identical official SpreadsheetML namespace binding in exactly 21
parts:

- `xl/workbook.xml`;
- `xl/sharedStrings.xml`;
- `xl/styles.xml`;
- `xl/worksheets/sheet1.xml` through `sheet10.xml`;
- `xl/tables/table1.xml` through `table8.xml`.

`xl/theme/theme1.xml` uses its proper DrawingML `a:` namespace and is not affected.
The original workbook remains valid OpenXML, but ExcelJS 4.4.0 does not accept this
prefix representation in its semantic readers.

M2 remains a low-priority migration bridge. The correction must support this exact
known package without becoming a general XML repair layer.

## Decision drivers and invariants

- Preserve the original XLSX bytes and original SHA-256 identity.
- Do not change element values, attributes other than the namespace binding, formulas,
  shared strings, styles, relationships or table definitions.
- Recognize only the exact official SpreadsheetML namespace bound to `x`.
- Reject a missing, additional or differently named SpreadsheetML part instead of
  discovering new producer variants heuristically.
- Keep all ZIP limits and rejection rules from ADR-0024.
- Keep compatibility private to the legacy XLSX adapter.

## Considered options

### Option A — Normalize the exact 21-part legacy manifest in memory

Require the evidenced paths and counts, then apply the same mechanical namespace
transformation independently to every listed part before passing the ephemeral ZIP to
ExcelJS.

### Option B — Normalize every XML file containing `xmlns:x`

This is shorter but silently broadens the supported profile and could rewrite an
unrelated extension part.

### Option C — Stop after workbook normalization and bypass failing ExcelJS readers

This would require a custom reader for shared strings, styles, worksheets and tables,
which is much larger than M2.

### Option D — Abandon the XLSX migration path

This avoids the shim but no longer imports the concrete existing campaign tracker,
which is the narrow purpose retained for M2.

## Decision and rationale

Select Option A.

The adapter defines one private immutable manifest containing the exact 21 paths above.
After the direct ExcelJS path fails, it:

1. validates the ZIP central directory and limits from ADR-0024;
2. requires every manifest path exactly once and rejects any other XML part bound to
   the SpreadsheetML `x` prefix;
3. decodes each manifest part as strict UTF-8;
4. requires exactly one `xmlns:x` binding to the official SpreadsheetML namespace and
   an `x:`-prefixed root element;
5. replaces only that binding with the default namespace and only `x:` prefixes on XML
   element names in the ephemeral copy;
6. verifies the default namespace, absence of remaining `x:` element names and
   preservation of all non-namespace text for the transformed part;
7. reconstructs the bounded in-memory ZIP and parses it with ExcelJS;
8. still requires the exact `BG3_TRACKER_LEGACY_V0` sheet/header profile.

The preservation check compares each transformed document with a canonical projection
that removes only the allowed namespace syntax. It does not interpret or repair XML.
No source or normalized workbook is written to disk.

## Boundaries and future onboarding

- This decision changes only the inbound legacy-file adapter.
- Staged campaign facts, normalization, import planning, validation and transactional
  mutation stay independent of XLSX and remain reusable by future onboarding flows.
- Clean campaign creation and mid-campaign bulk onboarding will not depend on this shim.
- The shim may be deleted once the known legacy campaigns have migrated.

## Data, transaction and audit impact

- No SQLite schema change is introduced.
- Compatibility processing remains read-only and precedes import planning.
- Failures produce zero canonical writes and zero audit events.
- Successful plans still follow ADR-0022: validation, one transaction and one audit
  event for a real state change.

## Security and privacy impact

- No new dependency is added beyond the already approved `fflate@0.8.3`.
- Archive path, encryption, compression, entry-count and declared-size checks remain
  mandatory before extraction.
- XML external entities, links, macros and formulas are never executed.
- Error messages expose stable categories rather than cell contents.

## Required tests and evidence

- A sanitized 21-part prefixed fixture parses to the same staged facts as its
  default-namespace equivalent.
- Missing, additional and wrong-namespace manifest parts fail explicitly.
- Unsafe ZIP paths, duplicate entries and size-limit tests from ADR-0024 remain green.
- Formula text, cached formula results, Polish shared strings, styles and table XML are
  preserved across the allowed transformation.
- The private acceptance test stages exactly 4 characters, 41 equipment rows, 188
  items, 42 abilities, 66 spells, 19 illithid powers and 10 legacy-log rows.
- Full `pnpm check`, frozen installation and high-severity dependency audit pass before
  delivery.

## Consequences and trade-offs

- The actual legacy tracker becomes importable without changing its source file.
- The shim touches more ephemeral XML parts than ADR-0024 originally allowed, but the
  manifest and transformation remain exact and small.
- Another producer or workbook shape is rejected rather than accumulated into M2.
- Long-term onboarding work remains focused on canonical campaign facts and bulk domain
  commands, not spreadsheet compatibility.

## Approval record

Accepted by the repository owner on 2026-08-28.

## Change log

- 2026-08-28 — Proposed after the accepted workbook-only transformation reached and
  failed on the same `x:` prefix in `xl/sharedStrings.xml`, followed by an exact
  read-only package inventory.
- 2026-08-28 — Accepted by the repository owner.
- 2026-08-29 — Implemented exact manifest-wide normalization with ZIP safety limits,
  root/namespace projection checks and rejection of additional prefixed XML parts;
  the real tracker acceptance succeeds.
