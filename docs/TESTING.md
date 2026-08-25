# Testing Strategy

## M0 quality gates

The repository-level gate is `pnpm check`. It verifies formatting, lint, strict TypeScript types, the Vitest suite and a production build. CI installs only from `pnpm-lock.yaml` and runs the same checks on Node.js 22.13.

M0 unit tests cover environment defaults, accepted values, blank values and safe validation failures. Later milestone test categories below become active when their corresponding implementation is added.

## Unit tests
Pure functions, schemas, resolver scoring, effective attribute calculations, domain invariants.

## Repository tests
SQLite CRUD and query semantics against temporary databases.

## Transaction tests
Verify rollback on invariant failure.

## Migration tests
Apply all migrations from empty DB and supported previous fixtures.

## Tool contract tests
Every tool validates input and stable result envelope.

## Scenario tests
Natural-language/domain workflows with expected mutation/no-mutation behavior.

## Model evals
Run curated cases to detect hallucinated item mapping, accidental state mutation, missing opportunity cost and failure to load canonical state.

## Bug policy
Every campaign-state bug discovered in real use should become a regression test before or together with the fix.
