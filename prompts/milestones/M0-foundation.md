# Codex Task — M0 — Repository Foundation

## Required reading

Read before changing code:
- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- all docs relevant to this milestone
- applicable ADRs

## Scope

Implementuj wyłącznie fundament repozytorium: Node.js 22+, TypeScript strict, pnpm, ESLint, Prettier, Vitest, walidowaną konfigurację środowiska i CI. Nie implementuj bazy kampanii, OpenAI, voice ani UI.

## Implementation rules

- Work only on this milestone.
- Preserve architectural invariants.
- Add or update tests before declaring completion.
- Update documentation affected by implementation.
- Update `CHANGELOG.md`.
- Do not silently change existing campaign data.
- Do not start the next milestone.

## Acceptance checks

- pnpm install z czystego klona
- pnpm lint
- pnpm typecheck
- pnpm test

## Required final report

Return:
1. files changed/created;
2. architecture decisions made;
3. commands/tests run and results;
4. migrations/state impact;
5. unresolved risks/questions;
6. suggested review points;
7. explicitly state that the next milestone was not started.
