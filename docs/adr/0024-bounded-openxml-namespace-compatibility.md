# ADR-0024: Bounded OpenXML namespace compatibility before ExcelJS parsing

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

Refines: ADR-0020 versioned XLSX adapter and legacy tracker contract

## Context and problem statement

ADR-0020 selected `exceljs` for the M2 XLSX adapter. Implementation against sanitized
ExcelJS-generated fixtures succeeds, but the mandatory private acceptance test against
`campaign/import/BG3_Campaign_Tracker.xlsx` exposed a compatibility failure.

The tracker is a valid readable OpenXML ZIP package whose `xl/workbook.xml` uses the
main spreadsheet namespace through an explicit `x:` prefix:

```xml
<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
```

ExcelJS 4.4.0 expects the same namespace as the default namespace while building its
workbook model. Its document reader throws `Cannot read properties of undefined
(reading 'sheets')`. Its streaming reader may finish without emitting worksheets. The
sanitized fixture and type gates therefore cannot substitute for the real-file
acceptance gate.

The original tracker must not be modified merely to accommodate a parser. M2 needs a
bounded compatibility decision before more parser code or dependencies are added.

M2 is a low-priority migration bridge. The expected long-term path is to create new
campaigns directly in SQLite rather than maintain spreadsheet compatibility. The
solution should therefore be the smallest safe shim that imports this concrete legacy
profile, not a reusable OpenXML repair subsystem.

## Decision drivers and invariants

- The private source workbook remains byte-for-byte unchanged.
- The SHA-256 identity in reports/audit refers to original source bytes.
- Compatibility logic must recognize one exact, evidenced OpenXML variation rather
  than repair arbitrary malformed XLSX files.
- Compressed and uncompressed size, entry count, duplicate names and unsafe ZIP paths
  must be checked before material is accepted.
- Workbook formulas, links, macros and cell text remain non-executable data.
- ExcelJS remains the single semantic workbook parser/writer selected by ADR-0020.
- Unsupported namespace/layout variants fail explicitly with zero canonical writes.
- Engineering and maintenance cost must stay proportional to a one-time legacy
  migration path; broad producer compatibility is an explicit non-goal.

## Considered options

### Option A — Bounded in-memory OpenXML namespace normalization, then ExcelJS

Inspect the ZIP package, recognize the exact prefixed main namespace in
`xl/workbook.xml`, rewrite only the namespace prefix in an in-memory copy, rebuild the
temporary byte representation and give that representation to ExcelJS. Preserve the
original file and digest.

### Option B — Replace ExcelJS with SheetJS Community Edition from npm

This may parse the tracker directly, but changes the approved reader/writer and brings
an older npm distribution and a different security/compatibility surface.

### Option C — Implement a complete OpenXML reader

This avoids a third-party workbook model but substantially expands M2 with ZIP, XML,
shared-string, relationship, formula and cell-type parsing.

### Option D — Rewrite the source workbook using Excel or another tool

This mutates migration input, changes its digest and hides the compatibility issue
rather than making import reproducible.

### Option E — Accept only ExcelJS-generated workbooks

This passes sanitized tests but fails M2's primary deliverable: importing the existing
tracker.

## Decision and rationale

Select Option A.

Add the exactly pinned, zero-transitive-dependency `fflate@0.8.3` package for bounded
ZIP inspection and in-memory reconstruction. Its published API supports ZIP extraction
filters containing declared `originalSize`, and synchronous ZIP reconstruction:
https://github.com/101arrowz/fflate.

The XLSX adapter follows this order:

1. Read original bytes once, enforce the existing compressed file-size limit and
   calculate the original SHA-256.
2. Attempt ordinary ExcelJS document parsing.
3. Only if that parsing fails, inspect the ZIP central directory through `fflate`.
4. Reject encrypted entries, duplicate entry names, absolute/backslash/traversal paths,
   excessive entry count, any entry above its declared uncompressed limit, or a total
   declared uncompressed size above the configured workbook limit.
5. Require exactly one `xl/workbook.xml` entry and the exact official spreadsheet
   namespace bound as `xmlns:x` on the `x:workbook` root.
6. In an in-memory copy of only that XML entry, replace `x:` on element names with the
   default namespace binding. Do not alter `r:id`, sheet names, relationships, cell
   XML, formulas, shared strings, styles or any other entry.
7. Verify the normalized root namespace, the absence of remaining `x:` element names
   and the expected worksheet relationship count before rebuilding the in-memory ZIP.
8. Parse the reconstructed bytes with the ordinary ExcelJS document reader and then
   apply all ADR-0020 sheet/header/cell limits and staging rules.

The compatibility representation is ephemeral. It is never written to disk, returned
as an export, hashed as source identity or treated as canonical data. If normalization
does not yield a valid, fully detected `BG3_TRACKER_LEGACY_V0` workbook, parsing fails
with a typed compatibility error.

The compatibility branch is covered by a sanitized prefixed-namespace fixture and the
explicit private acceptance test. The original standard ExcelJS path remains first so
M2-generated V1 exports do not pass through compatibility rewriting.

This is deliberately not a general normalization pipeline. It supports one exact
legacy signature, lives as a private helper beside the legacy adapter and may be
retired when the known legacy campaigns have migrated. It will not gain a plugin
system, producer detection, XML repair heuristics, configurable rewrite rules or UI.

## Boundaries and dependency direction

- ZIP inspection and namespace normalization are private functions of the inbound XLSX
  adapter.
- `fflate` sees bytes only and has no database, domain-service, filesystem-output or
  network capability.
- ExcelJS remains responsible for workbook relationships, shared strings, cells and
  formulas after compatibility normalization.
- Staging, normalization, planning and mutation boundaries from ADRs 0020–0022 remain
  unchanged.
- No compatibility API is exposed to UI, model or future tool callers.

## Data, migration and compatibility impact

- No SQLite schema or data migration is introduced.
- The original workbook is never changed.
- Report/reconciliation/audit source digests continue to use original bytes.
- One runtime dependency, exactly pinned `fflate@0.8.3`, is added to `package.json` and
  the lockfile after approval.
- The compatibility signature is specific to the evidenced legacy workbook namespace.
  New variations require a new tested rule or explicit rejection; they are not
  generalized silently.
- New campaigns do not use this path; they start from the canonical SQLite model.

## Transaction, validation, audit and rollback impact

Compatibility processing is read-only and runs before import planning or any SQLite
transaction. ZIP rejection, normalization failure or post-normalization ExcelJS
failure produces zero database writes and zero audit events.

The resulting staged model still follows ADR-0022's insert-only plan, full campaign
validation, one transaction and one audit event for a real state change.

## Security, privacy and external-data impact

- Compressed input is untrusted. Declared uncompressed sizes and entry paths are
  checked before accepting extraction.
- Only the exact namespace transformation is allowed. No general XML recovery,
  external entity resolution, macro execution or external-link fetching occurs.
- Cell and relationship content is not interpreted by the compatibility layer.
- Technical errors expose stable codes, not workbook contents.
- All temporary bytes remain in process memory and are released after staging.
- Dependency installation requires frozen-lock validation and a high-severity audit.

## Required tests and operational evidence

- Standard ExcelJS-generated fixtures use the direct path and remain unchanged.
- A sanitized workbook with the exact prefixed `x:` namespace fails direct ExcelJS,
  succeeds through compatibility normalization and produces the same staged facts as
  its default-namespace equivalent.
- The compatibility path preserves original SHA-256 and does not write a normalized
  workbook to disk.
- Reject unsafe ZIP paths, duplicate entries, excessive declared uncompressed size,
  missing/duplicate `xl/workbook.xml` and the wrong namespace.
- Prove formulas and shared strings remain unchanged and are not evaluated.
- The private acceptance test parses exactly 4 character, 41 equipment, 188 item, 42
  ability, 66 spell, 19 illithid and 10 legacy-log rows.
- Pin `fflate@0.8.3`; run frozen clean install, full `pnpm check`,
  `pnpm audit --audit-level high` and review the lockfile diff.

## Consequences and trade-offs

- M2 can import the actual tracker without modifying it or replacing ExcelJS.
- The adapter gains a small, tightly scoped ZIP compatibility layer and dependency.
- Reconstructing an in-memory ZIP costs additional CPU/memory only on the legacy
  fallback path; the workbook is small and bounded.
- ZIP metadata not needed for parsing may differ in the ephemeral copy, but no copy is
  persisted or used as source identity.
- Exact rejection makes the adapter less forgiving of unrelated producer quirks, which
  is intentional for canonical campaign import.
- The shim receives only corrective maintenance needed to migrate a known campaign;
  broader XLSX compatibility is deferred unless real demand changes the priority.

## Rejected alternatives

- Replacing ExcelJS is rejected because the evidenced issue is confined to one
  namespace representation and ExcelJS remains adequate for cells and export.
- A complete custom OpenXML parser is rejected as disproportionate M2 scope.
- Editing/resaving the real tracker is rejected because migration input must remain
  auditable.
- Broad regex/XML repair is rejected; only the exact root/element namespace prefix is
  normalized.
- Ignoring the private acceptance failure is rejected because it would falsely claim
  the milestone goal is met.

## Unresolved questions

None blocking. If `fflate` cannot enforce declared-size/path checks without relying on
undocumented internals, implementation must stop and return with a new proposal rather
than weakening ZIP defenses.

## Approval record

Accepted by the repository owner on 2026-08-28. Approval explicitly retained the
low-priority, narrowly scoped migration-bridge character of this decision.

## Change log

- 2026-08-28 — Proposed after direct and streaming ExcelJS 4.4.0 acceptance attempts
  failed on the real prefixed-namespace tracker while sanitized default-namespace
  fixtures passed.
- 2026-08-28 — Narrowed after owner priority guidance: M2 is a low-priority one-time
  migration bridge, while new campaigns should start directly in SQLite.
- 2026-08-28 — Accepted by the repository owner.
