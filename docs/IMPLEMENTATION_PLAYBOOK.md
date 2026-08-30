# Implementation Playbook

The authoritative end-to-end process is `docs/MILESTONE_DELIVERY_WORKFLOW.md`. This playbook is a short orientation; agents implementing a milestone must follow the full workflow.

## One milestone per Codex task

Use a fresh task or clearly scoped turn for one roadmap milestone. Attach the repository and use the matching prompt from `prompts/milestones/`.

## Required delivery cycle

1. **Scope** the exact milestone and create a dedicated `codex/` branch.
2. **Propose ADRs** for every milestone architectural decision.
3. **Obtain user approval**, mark approved ADRs `Accepted` and stop if any blocking decision remains proposed.
4. **Implement** using the matching milestone prompt while keeping ADRs current.
5. **Validate** local quality gates and milestone-specific exit criteria.
6. **Inspect** the complete diff, ADR alignment, state impact, docs and changelog.
7. **Commit and push** only in-scope changes.
8. **Open a PR** with ADR approvals, validation, migration/state impact, risks and non-goals.
9. **Wait for CI/security checks** on the latest commit.
10. **Run AI review** using the connected PR integration or an independent reviewer with `prompts/review-milestone.md`.
11. **Fix and revalidate** every valid blocking finding; re-enter ADR approval when a decision changes.
12. **Ask for human approval** and stop. Never merge without explicit instruction.

## Suggested Git tags

- `m0-foundation`
- `m1-database`
- ...
- `m15-onboarding`
- `m16-reliability`

## When a real gameplay bug appears

Use `prompts/bugfix-regression.md`. First create a failing regression, then fix.

## How to prompt Codex effectively

Include:

- exact milestone/issue;
- file paths when known;
- expected behavior;
- explicit non-goals;
- acceptance tests;
- request to stop after completion.

Avoid prompts like "improve the app" or "continue building".

## Schema evolution

Never ask Codex to manually edit a live DB. Schema changes are migrations. Data reconciliation should create explicit migration/import reports and backups.

## Campaign data during development

Use sanitized fixtures for most tests. Treat `campaign/import/BG3_Campaign_Tracker.xlsx` as real campaign data and keep it out of public repositories if privacy matters.
