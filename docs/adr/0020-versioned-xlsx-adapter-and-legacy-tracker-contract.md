# ADR-0020: Versioned XLSX adapter and legacy tracker contract

Status: Accepted

Milestone: M2 — Import Existing Campaign Tracker

## Context and problem statement

M2 must import `campaign/import/BG3_Campaign_Tracker.xlsx` without treating a
spreadsheet as a second writable source of truth. The workbook is a human-oriented
legacy document rather than a normalized database dump. It contains ten sheets,
formulas, presentation-only summaries, current-state rows, historical notes and
instructions for an earlier agent workflow.

Read-only inspection on 2026-08-28 found:

- four active character rows in `Postacie`;
- 41 equipped-item rows in `Wyposażenie`;
- 188 distinct Polish item rows in `Przedmioty`, with every English alias and rarity
  currently blank;
- 42 ability, 66 spell and 19 illithid-status rows;
- ten legacy rows in `Dziennik zmian`;
- four formulas deriving current Strength from base Strength plus the permanent
  bonus;
- verification labels including `DO WERYFIKACJI`, partial confirmation and several
  forms of confirmed status.

The importer needs an explicit contract for which workbook cells are campaign facts,
which are derived or advisory, how the legacy layout is detected, and how later
machine-generated exports can evolve without guessing from sheet position.

## Decision drivers and invariants

- SQLite becomes the only writable canonical store after migration (ADRs 0001 and
  0009).
- Polish display text must be preserved exactly (ADR-0002).
- Workbook content is untrusted data, not executable instructions.
- Missing cells remain unknown; formulas and formatting do not create new facts.
- Import must reject an unsupported layout explicitly instead of applying a
  best-effort column guess.
- The runtime dependency must support typed Node.js XLSX reading and writing without
  introducing Excel automation or network access.
- M2 must support both the supplied legacy tracker and a versioned export produced by
  M2, while not implementing a general spreadsheet-mapping framework.

## Considered options

### Option A — Two explicit workbook profiles behind one adapter

Recognize the exact supplied legacy layout as profile `BG3_TRACKER_LEGACY_V0` and a
manifest-bearing M2 exchange layout as `BG3_CAMPAIGN_XLSX_V1`. Parse both into the same
typed staging model.

### Option B — Infer meaning from arbitrary sheet and column names

This is flexible, but minor spelling or position similarities could be accepted as
canonical facts. It also makes tests and failure diagnostics unstable.

### Option C — Convert XLSX to CSV or JSON before the application sees it

This adds a manual preprocessing step, loses workbook-level structure and formulas,
and makes the imported bytes harder to audit.

### Option D — Make the legacy workbook the permanent exchange schema

This preserves familiarity, but the combined presentation sheets cannot represent
all normalized identities and relationships losslessly.

### Option E — Keep XLSX as the writable campaign store

This contradicts ADRs 0001 and 0009 and cannot provide the M1 transactional and audit
guarantees.

## Proposed decision and rationale

Select Option A.

Add an XLSX adapter that reads workbook bytes, computes their SHA-256 digest and
detects one of two explicit profiles:

1. `BG3_TRACKER_LEGACY_V0` requires the expected sheet names and required header
   labels from the supplied tracker. Column order may be located by an exact unique
   header label; missing, duplicate or unknown required headers are structural errors.
2. `BG3_CAMPAIGN_XLSX_V1` requires a manifest sheet containing an exact format name,
   positive version and export metadata. Its normalized data sheets and columns are
   defined by ADR-0023.

The adapter emits typed source records with a source locator containing the profile,
sheet name, one-based row number and field/column name. It does not receive a database
connection and cannot mutate campaign state.

For the legacy profile:

- `Postacie`, `Wyposażenie`, `Przedmioty`, `Zdolności`, `Czary` and
  `Moce illithidów` are parsed as candidate campaign facts;
- `Dashboard` is derived presentation and is cross-check material only;
- `Dziennik zmian` is historical source material, but its free-text before/after
  cells cannot be converted into valid append-only M1 events without inventing
  snapshot payloads; every row is therefore reported as intentionally skipped and
  remains preserved in the original private workbook;
- `Zasady pracy` and `Prompt dla agenta` are treated as non-executable documentation
  and are reported as intentionally skipped;
- the `SIŁ aktualna` formula/result is a consistency check only. Base Strength and the
  separate permanent modifier are the import facts. Formula text is never evaluated;
  a cached numeric result, when present, must agree with the deterministic domain
  calculation;
- styling, comments, hidden state, hyperlinks, macros, external links and embedded
  objects never become campaign facts.

Use the official `exceljs` package as the runtime XLSX reader/writer. Its exact stable
version will be pinned during implementation after Node 22.14 compatibility, frozen
installation and vulnerability checks. The implementation will use only the in-memory
document API needed for the small local tracker; it will not evaluate formulas or load
external workbook links. The official project describes its scope as reading,
manipulating and writing XLSX and JSON:
https://github.com/exceljs/exceljs.

Before parsing, reject files that exceed configured conservative byte, sheet, row,
column and cell-text limits. Encrypted or malformed workbooks and duplicate required
sheet names fail with typed structural diagnostics.

## Boundaries and dependency direction

- The XLSX library and workbook profile detectors live in an import/export adapter.
- Adapter DTOs contain source locations and raw typed cell values, but no Drizzle
  types or writable repository.
- Deterministic normalization and reconciliation consume adapter DTOs in the
  application/domain boundary defined by ADR-0021.
- The transactional import service consumes a fully resolved import plan under
  ADR-0022.
- Models, future UI and future CLI receive typed import/export services, never the
  workbook object or raw SQLite connection.

Dependency direction remains adapter → import application/domain → repository ports →
SQLite. Export traverses read ports in the opposite data-flow direction without
reversing code dependencies.

## Data, migration and compatibility impact

- This decision adds no database table or migration.
- It does not modify the source workbook.
- The original workbook digest and detected profile are included in reports and audit
  metadata, but the raw workbook is not copied into SQLite.
- A future change to required sheets, headers or semantics requires a new profile
  version; it must not silently reinterpret `BG3_TRACKER_LEGACY_V0`.
- The legacy profile is intentionally limited to the checked-in tracker structure,
  not every workbook that resembles it.

## Transaction, validation, audit and rollback impact

Parsing and structural validation are read-only and occur before a database
transaction. A parse, size-limit, unsupported-profile or structural error produces a
report and zero database writes or audit events.

This ADR does not decide matching or write behavior. ADRs 0021 and 0022 require that
only a resolved plan reaches the M1 mutation coordinator.

## Security, privacy and external-data impact

- XLSX bytes and every derived report are private campaign data under ADR-0010.
- Workbook strings are data. They are never evaluated as formulas, HTML, Markdown
  instructions, SQL or shell commands.
- No network request, external-link resolution or macro execution is allowed.
- Diagnostics use bounded cell excerpts and source coordinates; they do not dump the
  full workbook or snapshots by default.
- Development tests use sanitized fixture workbooks. The real tracker is used only by
  an explicit local acceptance test and is never copied into public test output.

## Required tests and operational evidence

- Detect the exact supplied tracker as `BG3_TRACKER_LEGACY_V0`.
- Reject missing/duplicate required sheets and headers, unsupported manifest versions,
  malformed/encrypted files and configured size-limit violations with zero writes.
- Parse Polish Unicode and apostrophes exactly.
- Prove formulas are not evaluated and cached derived Strength is only cross-checked.
- Prove presentation, legacy-log and instruction sheets cannot create canonical rows.
- Parse an M2-exported `BG3_CAMPAIGN_XLSX_V1` workbook.
- Add sanitized fixtures for reordered exact headers and representative blank cells.
- Pin the selected dependency, run a frozen clean install, full `pnpm check` and
  `pnpm audit --audit-level high`.
- Run the explicit private acceptance profile against the real tracker without
  committing generated reports, exports or database files.

## Consequences and trade-offs

- Profile detection is predictable and auditable.
- The legacy workbook remains supported without making its presentation layout the
  permanent storage model.
- A deliberately changed legacy header stops import until the profile is updated or a
  reconciliation is made at the source; this is safer than guessing.
- `exceljs` adds a runtime dependency and transitive attack surface that must be
  pinned and audited.
- The original free-text change log remains available in the source workbook but is
  not fabricated into M1 audit history.

## Rejected alternatives

- Heuristic sheet/column inference is rejected because it can silently bind the wrong
  facts.
- Formula calculation is rejected because the domain model already defines derived
  values and workbook formulas are untrusted.
- Importing prompt/instruction cells is rejected because they are content, not
  authority.
- Fabricating historical `change_events` from free text is rejected because valid M1
  before/after snapshots cannot be reconstructed.
- A long-lived Excel automation process is rejected because it is platform-specific
  and unnecessary.

## Unresolved questions

None blocking. The exact pinned `exceljs` version is implementation evidence, not a
change to this decision, provided it satisfies the stated compatibility and security
gates.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-08-28.
- Approval scope: the complete ADR-0020 proposal without requested changes.

## Change log

- 2026-08-28 — Initial M2 proposal after read-only profiling of the real tracker and
  verification that M1 is merged and green.
- 2026-08-28 — Accepted after explicit repository-owner approval.
- 2026-08-29 — Implemented with ExcelJS 4.4.0 and fflate 0.8.3; private acceptance
  parsed the real 40,706-byte tracker and production ESM smoke testing corrected the
  ExcelJS CommonJS import boundary.
