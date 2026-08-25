# Codex Bugfix + Regression Prompt

A production/campaign bug has been found.

1. Read `AGENTS.md` and relevant specs.
2. Reproduce the bug with the smallest possible automated regression test.
3. Confirm the test fails before the fix.
4. Implement the smallest domain-correct fix.
5. Run the regression plus relevant full test groups.
6. Update CHANGELOG and relevant docs if behavior changes.
7. Do not refactor unrelated code.
8. Report whether any persisted campaign state requires reconciliation.
