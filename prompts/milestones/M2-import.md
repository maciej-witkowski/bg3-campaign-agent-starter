# Codex Task — M2 — Import Existing Campaign Tracker

## Required reading

Read before changing code:
- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- all docs relevant to this milestone
- applicable ADRs

## Scope

Zaimplementuj idempotentny importer BG3_Campaign_Tracker.xlsx do SQLite. Zachowaj polskie nazwy, status weryfikacji i permanentne modyfikatory. Generuj raport inserted/matched/skipped/ambiguous/conflicts. Nie zgaduj aliasów EN.

## Implementation rules

- Work only on this milestone.
- Preserve architectural invariants.
- Add or update tests before declaring completion.
- Update documentation affected by implementation.
- Update `CHANGELOG.md`.
- Do not silently change existing campaign data.
- Do not start the next milestone.

## Acceptance checks

- drugi import nie zmienia stanu
- Lae'zel +2 STR zachowane z provenance
- eksport XLSX/JSON działa

## Required final report

Return:
1. files changed/created;
2. architecture decisions made;
3. commands/tests run and results;
4. migrations/state impact;
5. unresolved risks/questions;
6. suggested review points;
7. explicitly state that the next milestone was not started.
