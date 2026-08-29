# Changelog

## Unreleased

- Implemented M2 legacy XLSX staging, exact Polish normalization, entity-specific planning and one-transaction audited campaign import.
- Added deterministic import reports and digest-bound reconciliation documents for skipped, ambiguous and conflicting source facts.
- Applied validated reconciliation decisions to staged values and conservative import plans, including explicit alias attestation, candidate selection, treating a fact as new and skipping a source fact.
- Hardened M2 review boundaries by validating campaign state before export and checking import-plan freshness inside the mutation transaction.
- Added versioned current-state JSON and normalized XLSX exports with literal campaign text, strict validation, SHA-256 integrity and verified atomic publication.
- Added stable-ID JSON/XLSX round-trip import into empty databases, idempotent re-import and refusal to overwrite a different non-empty campaign.
- Added a private real-tracker acceptance harness and database review report covering integrity, collection counts, character statistics, equipment, travel-chest contents and unresolved issues.
- Added bounded OpenXML compatibility for the legacy SpreadsheetML namespace variant and corrected ExcelJS CommonJS interoperability in production ESM builds.
- Implemented the M1 canonical SQLite database with committed Drizzle migrations and hardened connection settings.
- Added the normalized campaign model for characters, attributes, modifiers, items, inventory, equipment, spells, abilities and illithid powers.
- Added typed transactional mutation services with pre-commit campaign validation and append-only audit events containing deterministic before/after snapshots.
- Added versioned deterministic campaign snapshots and atomic checkpoints with SHA-256 integrity metadata.
- Made snapshot identity ordering locale-independent and total for canonically equivalent Unicode strings.
- Added forward legacy-checkpoint classification and structured checkpoint-to-audit provenance.
- Hardened review-discovered boundaries: equipment swaps update placement only, default migrations are module-relative, and nullable integer fields reject fractional values transactionally.
- Rejected missing equipment references and blank optional facts transactionally so stale commands cannot masquerade as no-ops and unknown values remain `NULL`.
- Rejected non-finite optional numeric facts and conflicting duplicate equipment commands before persistence.
- Made assignment-only equipment swaps atomic and added preflight rejection for incomplete or conflicting slot commands.
- Derived equipment audit character provenance from both current and requested assignments, including removals and cross-character moves.
- Rejected ambiguous equipped stacks transactionally: an equipped inventory row now represents exactly one physical item.
- Added empty-database and upgrade migration coverage, domain invariant and rollback tests, Polish-name/null round trips, and checkpoint integrity tests.
- Recorded the approved M1 architecture in ADRs 0012–0019 and documented the implemented data model and test strategy.
- Added a mandatory end-to-end milestone delivery workflow covering scope, implementation, tests, branch and commit discipline, pull requests, CI/security checks, AI review remediation and human approval.
- Added a mandatory pre-implementation ADR proposal and user-approval gate, plus continuous ADR maintenance and re-approval rules for changed decisions.
- Expanded the milestone review prompt with scope, security, dependency, migration and current-head validation checks.
- Required Codex review immediately after PR creation and explicit user approval of the remediation plan before review-driven edits.
- Added ADR-scoped review batching, stacked-PR guidance and a milestone-wide stabilization sweep before repeated AI review.
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
