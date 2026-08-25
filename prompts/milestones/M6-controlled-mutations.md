# Codex Task — M6 — Controlled Mutations

## Required reading

Read before changing code:
- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- all docs relevant to this milestone
- applicable ADRs

## Scope

Dodaj proposal store, confirmation resolver i mutacje: add_owned_item, equip_item, chest/sold, prepared spells, abilities, illithid, permanent modifiers, checkpoint, undo. Każda mutacja: transaction + validate + audit + snapshot.

## Implementation rules

- Work only on this milestone.
- Preserve architectural invariants.
- Add or update tests before declaring completion.
- Update documentation affected by implementation.
- Update `CHANGELOG.md`.
- Do not silently change existing campaign data.
- Do not start the next milestone.

## Acceptance checks

- suggestion nie zapisuje
- explicit confirm zapisuje
- ambiguous confirm nie zapisuje
- undo tworzy reversal event

## Required final report

Return:
1. files changed/created;
2. architecture decisions made;
3. commands/tests run and results;
4. migrations/state impact;
5. unresolved risks/questions;
6. suggested review points;
7. explicitly state that the next milestone was not started.
