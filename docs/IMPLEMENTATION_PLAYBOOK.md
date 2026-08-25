# Implementation Playbook

## One milestone per Codex task

Use a fresh task or clearly scoped turn for one roadmap milestone. Attach the repository and use the matching prompt from `prompts/milestones/`.

## Recommended cycle

1. **Implement** using milestone prompt.
2. **Inspect git diff** manually.
3. **Review** with `prompts/review-milestone.md` in a separate Codex task when milestone is substantial.
4. **Fix findings** with a narrowly scoped prompt.
5. Run tests locally.
6. Commit with milestone-oriented message.
7. Only then start next milestone.

## Suggested Git tags

- `m0-foundation`
- `m1-database`
- ...
- `m15-reliability`

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
