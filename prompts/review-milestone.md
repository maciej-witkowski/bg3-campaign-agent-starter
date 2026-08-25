# Codex Review Prompt

Review the implementation of the stated milestone as a state-critical application.

Read `AGENTS.md`, `SPECIFICATION.md`, `ROADMAP.md`, relevant docs and ADRs first.

Do not add new product features. Review for:

- mismatch with the milestone deliverables, non-goals or exit criteria;
- implementation without an explicitly user-approved `Accepted` ADR;
- ADR decisions, consequences or evidence drifting from implementation;
- violation of canonical-state rules;
- hidden/silent mutations;
- missing transaction boundaries;
- missing audit events;
- missing rollback/validation;
- unsafe alias resolution;
- accidental coupling to a specific model;
- tests that only cover happy paths;
- docs drifting from implementation.
- secrets, private campaign data or generated state included in the diff;
- unsafe dependency, CI, migration or rollback behavior;
- changes that belong to a later milestone.

Inspect the full PR diff and the status of checks for the current head. Run relevant local checks when available.

Produce:

1. findings ordered by severity with file/line references;
2. explicit confirmation when no findings remain;
3. a minimal remediation plan;
4. missing test or validation evidence;
5. scope, migration and campaign-state impact;
6. ADR approval and implementation-alignment status;
7. whether the PR is ready for human approval.

Review only. Do not implement fixes in the review pass.
