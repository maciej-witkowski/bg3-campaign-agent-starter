# Codex Task — M3 — Read-Only CLI

## Required reading

Read before changing code:
- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- all docs relevant to this milestone
- applicable ADRs

## Scope

Dodaj read-only CLI: party, character, equipment, inventory, spells, illithid, changes, validate, export. Poza exportem nie wolno wykonywać mutacji.

## Implementation rules

- Work only on this milestone.
- Preserve architectural invariants.
- Add or update tests before declaring completion.
- Update documentation affected by implementation.
- Update `CHANGELOG.md`.
- Do not silently change existing campaign data.
- Do not start the next milestone.

## Acceptance checks

- testy CLI
- JSON output mode
- brak zapisu do DB

## Required final report

Return:
1. files changed/created;
2. architecture decisions made;
3. commands/tests run and results;
4. migrations/state impact;
5. unresolved risks/questions;
6. suggested review points;
7. explicitly state that the next milestone was not started.
