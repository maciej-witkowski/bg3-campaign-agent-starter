# ADR-0001: SQLite is the canonical campaign store

Status: Accepted

## Context
Long-lived chat and document-based state caused drift, duplicates and stale facts.

## Decision
Use local SQLite as the only writable canonical campaign state. XLSX/JSON are exports.

## Consequences
- reliable transactions and queries;
- easy local backup;
- requires migrations and domain services;
- spreadsheet editing cannot directly change canonical state.
