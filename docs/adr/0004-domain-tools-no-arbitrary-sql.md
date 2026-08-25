# ADR-0004: Models and UI use domain tools, not arbitrary SQL

Status: Accepted

## Decision
Expose small typed operations. SQL remains inside repository/domain implementation.

## Consequences
More code, but state invariants and audits are enforceable and testable.
