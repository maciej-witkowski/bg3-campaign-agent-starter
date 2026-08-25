# Architecture Decision Records

Format: `NNNN-short-title.md`.

Each ADR contains: status, context, decision, consequences and supersession notes.

## Convention

1. Copy the structure of an existing ADR and assign the next four-digit number.
2. Use a short lowercase kebab-case title in the filename.
3. Set status to `Proposed`, `Accepted`, `Superseded` or `Rejected`.
4. Record the context and trade-offs, not only the selected technology.
5. Never rewrite an accepted decision to hide a later change. Add a new ADR and link the superseded record in both files.

ADRs are plain Markdown and require no generator. Review them in the same pull request as the implementation they govern.

## Milestone approval lifecycle

Before milestone implementation, create detailed ADRs with status `Proposed`. Implementation code, schemas, migrations and runtime dependencies must wait for explicit user approval.

After approval, record the approver and date, then set the ADR to `Accepted`. Keep the ADR current during implementation by updating evidence, consequences and its change log.

Do not rewrite an accepted ADR to hide a material decision change. Create a new `Proposed` ADR that supersedes it, pause affected implementation, obtain user approval, then mark the new ADR `Accepted` and the earlier record `Superseded`.

## Required milestone ADR sections

1. Status and milestone.
2. Context and problem statement.
3. Decision drivers and invariants.
4. Considered options, including the status quo.
5. Proposed decision and rationale.
6. Boundaries and dependency direction.
7. Data, migration and compatibility impact.
8. Transaction, validation, audit and rollback impact.
9. Security, privacy and external-data impact.
10. Required tests and operational evidence.
11. Consequences and trade-offs.
12. Rejected alternatives.
13. Unresolved questions.
14. Approval record.
15. Change log.
