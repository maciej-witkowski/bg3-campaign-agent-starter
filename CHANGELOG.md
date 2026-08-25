# Changelog

## Unreleased

- Added a mandatory end-to-end milestone delivery workflow covering scope, implementation, tests, branch and commit discipline, pull requests, CI/security checks, AI review remediation and human approval.
- Added a mandatory pre-implementation ADR proposal and user-approval gate, plus continuous ADR maintenance and re-approval rules for changed decisions.
- Expanded the milestone review prompt with scope, security, dependency, migration and current-head validation checks.
- Required Codex review immediately after PR creation and explicit user approval of the remediation plan before review-driven edits.
- Limited write-mode formatting to explicit milestone-owned paths when unrelated user changes are present.

## 0.2.0 — M0 Repository Foundation

- Added a Node.js 22+ and pnpm project with a committed dependency lockfile.
- Added strict TypeScript ESM build and source/test directory structure.
- Added ESLint, Prettier, Vitest and unified local quality scripts.
- Added Zod-validated, explicitly loaded environment configuration with unit tests.
- Added CI for frozen installation, formatting, lint, typecheck, tests and build.
- Documented package scripts and the ADR convention; recorded the foundation toolchain decision in ADR 0011.
- Kept database, OpenAI, voice, UI and campaign-domain implementation out of M0.

## 0.1.0 — Starter specification

- Added complete product specification.
- Added architecture and domain documentation.
- Added roadmap and milestone implementation prompts.
- Added ADR baseline.
- Added tool and domain JSON schemas.
- Added example JSONL tool-call traces.
- Added initial scenario regression corpus.
