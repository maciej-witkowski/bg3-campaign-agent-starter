# ADR-0009: XLSX is import/export only after migration

Status: Accepted

## Decision
The existing `BG3_Campaign_Tracker.xlsx` is migration input and a future human-readable export. After SQLite migration, manual XLSX edits do not mutate canonical state.
