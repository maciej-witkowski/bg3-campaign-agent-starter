# Testing Strategy

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
