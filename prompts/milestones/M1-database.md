# Codex Task — M1 — Canonical Campaign Database

## Required reading

Read before changing code:
- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- all docs relevant to this milestone
- applicable ADRs

## Scope

Zaimplementuj SQLite + Drizzle zgodnie z DATA_MODEL.md. Dodaj migracje, repozytoria, transakcje, audit events, checkpoint primitives i validateCampaignState(). Wszystkie mutacje muszą być transakcyjne i testowane pod rollback.

## Implementation rules

- Work only on this milestone.
- Preserve architectural invariants.
- Add or update tests before declaring completion.
- Update documentation affected by implementation.
- Update `CHANGELOG.md`.
- Do not silently change existing campaign data.
- Do not start the next milestone.

## Acceptance checks

- migracja empty→latest
- testy invariantów
- test rollbacku
- aktualizacja DATA_MODEL.md

## Required final report

Return:
1. files changed/created;
2. architecture decisions made;
3. commands/tests run and results;
4. migrations/state impact;
5. unresolved risks/questions;
6. suggested review points;
7. explicitly state that the next milestone was not started.
