# ADR-0008: Campaign mutations use append-only audit events

Status: Accepted

## Decision
Do not delete history when undoing. Create reversal events and preserve before/after snapshots.
