# Changelog

## Unreleased

- Implemented M4 provider-independent typed tool contracts with normative JSON Schema,
  strict Zod mirrors and automated parity/drift coverage.
- Added separate immutable read/analysis, proposal and mutation catalogs and registries;
  the production M4 composition exposes only nine read and four deterministic analysis
  tools over an enforced read-only SQLite connection.
- Added JSON-safe snake_case tool DTOs, stable success/failure envelopes, bounded error
  details and a schema-first executor that validates input before handlers and output
  before publication.
- Added an out-of-band mutation authorization boundary bound to exact tool, full parsed
  payload and confirmation claim through a versioned canonical SHA-256 digest. Proposal
  storage, confirmation resolution and concrete mutations remain M6 scope.
- Added M4 contract, registry, executor, read-only and authorization regressions,
  including fabricated-confirmation scenarios proving zero campaign-state writes.
- Recorded the approved M4 architecture in ADRs 0030–0033 and maintained a resumable
  per-ADR implementation tracker.
- Implemented the M3 local read-only CLI with `party`, `character`, `equipment`,
  `inventory`, `spells`, `illithid`, `changes`, `validate` and `export` commands.
- Added a dedicated existing-file-only SQLite connection with driver read-only mode,
  `query_only` defence and exact non-mutating migration/schema compatibility checks.
- Added typed deterministic inspection projections, conservative Polish character-name
  resolution, derived effective attributes and exact stored-effect inventory facets.
- Added the versioned `BG3_CLI_RESULT` V1 JSON envelope, Polish human output, strict
  native argument parsing, safe error mapping and stable process exit categories.
- Added the `bg3-campaign` production executable, JSON/XLSX export dispatch and
  child-process smoke coverage proving all M3 commands leave canonical SQLite bytes
  unchanged.
- Made M3 export creation-only for CLI and direct application consumers, protected the
  campaign database, filesystem aliases and SQLite companion files, and made complete
  CLI validation observe one transactional snapshot.
- Completed human equipment effect and inventory quantity output.
- Recorded the approved M3 architecture in ADRs 0026–0029 and added a durable
  per-ADR implementation tracker.
- Added M15 Campaign Initialization and Onboarding after the core product workflows, with clean-start and mid-campaign entry modes; moved Reliability / Evals / Long-Term Operations to M16.
- Implemented M2 legacy XLSX staging, exact Polish normalization, entity-specific planning and one-transaction audited campaign import.
- Added deterministic import reports and digest-bound reconciliation documents for skipped, ambiguous and conflicting source facts.
- Applied validated reconciliation decisions to staged values and conservative import plans, including explicit alias attestation, candidate selection, treating a fact as new and skipping a source fact.
- Hardened M2 review boundaries by validating campaign state before export and checking import-plan freshness inside the mutation transaction.
- Hardened issued import plans against copying or mutation, classified conflicting pending capability assignments before persistence and separated canonical-export XLSX limits from legacy-tracker limits.
- Preserved per-row source locations for capability-assignment reconciliation, matched illithid prerequisites by their composite identity and normalized sold inventory as ownerless.
- Reconciled equipment against both persisted and pending slot occupants, removed dependent new equipped inventory when its assignment is skipped and hardened issued-plan integrity against serialization hooks.
- Rejected ambiguous duplicate character display names before reference resolution and separated per-character illithid status from shared power-definition identity.
- Required source-workbook correction for duplicate character display names instead of allowing unsafe row-local reconciliation with unchanged dependent references.
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
