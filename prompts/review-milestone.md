# Codex Review Prompt

Review the implementation of the stated milestone as a state-critical application.

Read `AGENTS.md`, `SPECIFICATION.md`, `ROADMAP.md`, relevant docs and ADRs first.

Do not add new product features. Review for:
- violation of canonical-state rules;
- hidden/silent mutations;
- missing transaction boundaries;
- missing audit events;
- missing rollback/validation;
- unsafe alias resolution;
- accidental coupling to a specific model;
- tests that only cover happy paths;
- docs drifting from implementation.

Run relevant checks. Produce findings ordered by severity with file/line references, then a minimal patch plan. Only implement fixes if explicitly requested.
