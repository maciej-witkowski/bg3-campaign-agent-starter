# Import and export

## Authority and privacy

SQLite is the only writable canonical campaign store. The legacy workbook, import reports, reconciliation documents and exports are private exchange artifacts. Files generated under `campaign/exports/` are ignored by Git. Import never modifies the source workbook.

## Legacy tracker import

`BG3_TRACKER_LEGACY_V0` recognizes the exact ten-sheet tracker contract. The adapter validates archive limits, worksheet names, headers and scalar cell types. It never evaluates formulas, macros, links, prompts or historical free text.

Normalization preserves exact Polish display strings, maps only allow-listed legacy tokens and keeps unknown values unknown. Planning classifies every fact as inserted, matched, skipped, ambiguous or conflicting. A blocked or stale plan writes nothing. An accepted plan runs through the M1 coordinator as one transaction with state validation and one audit event. A repeated identical import is a no-op.

`BG3_IMPORT_REPORT` contains the complete classification. `BG3_IMPORT_RECONCILIATION` contains digest-bound uncertain decisions with a closed resolution schema; neither artifact is canonical state.

Duplicate character display names must be corrected directly in the source tracker
together with every dependent owner, equipment and capability reference. A row-local
reconciliation value or skip is refused because it cannot identify which character
the unchanged references describe.

## Current-state exchange

`BG3_CAMPAIGN_EXPORT` JSON and `BG3_CAMPAIGN_XLSX` XLSX version 1 encode the same 14 canonical current-state collections and stable IDs as the M1 snapshot boundary. The XLSX workbook contains `Metadane` followed by one fixed normalized sheet per collection. Campaign strings are written as literal cell values, never formulas or hyperlinks.

Export captures a consistent validated read snapshot and creates no audit event. Artifacts are written to sibling temporary files, verified after serialization and published without overwriting an existing target unless explicitly requested.

Importing a normalized export is intended for a fresh database. It preserves IDs, performs one validated audited transaction and becomes a no-op when repeated. A different non-empty target is refused. This exchanges current state only; audit/checkpoint backup and restore remain M16.

## Private acceptance command

After `pnpm build`, provide a new output prefix whose files do not exist:

```sh
node scripts/verify-m2-real-import.mjs campaign/import/BG3_Campaign_Tracker.xlsx campaign/exports/M2-review
```

The command creates a primary SQLite database, JSON report, reconciliation file, JSON/XLSX state exports, a Markdown database review and two fresh round-trip databases. It verifies first-import change, second-import no-op, equal state digests, `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
