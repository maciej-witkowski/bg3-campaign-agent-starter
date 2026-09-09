# M4 — Typed Tool Layer — Implementation Tracker

Status: In progress

Branch: `codex/m4-typed-tool-layer`

Base commit: `6327344` (`docs: record final M3 review evidence`)

Milestone owner approval: ADR-0030 through ADR-0033 accepted in the Codex task on
2026-09-01.

## Purpose and resume protocol

This file is the durable execution ledger for M4. Update it after every material slice,
test run, commit, review finding and changed assumption. A resumed agent must:

1. read `AGENTS.md`, the M4 milestone contract and ADR-0030 through ADR-0033;
2. read this tracker from top to bottom;
3. run `git status --short`, inspect untracked/modified files and preserve them;
4. continue only the first session marked `In progress` or `Pending`;
5. do not start M5 and do not change an accepted decision without a new proposed ADR;
6. do not remediate PR/Codex review findings before explicit repository-owner approval.

## Milestone contract

Goal: expose domain operations as strongly typed, provider-independent tool contracts.

Required deliverables:

- Zod schemas corresponding to normative JSON Schema contracts;
- schema parity/drift protection;
- immutable catalog and capability-separated registries;
- stable typed success/failure result envelopes;
- read and deterministic analysis tools callable without an LLM;
- proposal contract types without a proposal store;
- mutation contracts guarded by explicit confirmation metadata and trusted out-of-band
  authorization context;
- tests proving invalid inputs fail before domain logic and read-only callers cannot
  invoke mutations.

Explicit non-goals:

- OpenAI/Responses API integration (M5);
- production proposal persistence, confirmation resolution and controlled mutation
  workflows (M6);
- fuzzy item resolution or alias persistence (M7);
- external research providers (M8);
- merchant sessions (M9);
- heuristic synergy tags/scoring (M14);
- any SQLite migration or canonical campaign-data rewrite.

## Session plan and state

### Session 0 — Approval gate and tracking

Status: Completed

Owned paths:

- `docs/adr/0030-*.md` through `docs/adr/0033-*.md`
- `docs/milestones/M4_IMPLEMENTATION_TRACKER.md`

Exit evidence:

- all four ADRs are `Accepted` with owner/date recorded;
- tracker exists and accurately describes scope/resume steps;
- documentation formatting and `git diff --check` pass;
- scoped documentation commit created.

### Session 1 — ADR-0030 contracts and schema parity

Status: Completed

Expected owned paths:

- `schemas/domain/**`
- `schemas/tools/**`
- `src/tools/contracts/**`
- focused contract/parity tests
- ADR-0030 implementation evidence and this tracker

Exit evidence:

- every M4-governed JSON schema has a strict non-coercing Zod counterpart;
- shared valid/invalid corpus proves semantic parity;
- missing pair, extra properties, boundaries and confirmation variants are covered;
- no handler runs for invalid input;
- scoped tests, typecheck and formatting pass;
- focused ADR-0030 commit created.

### Session 2 — ADR-0031 catalog, registries and read/analysis tools

Status: Completed

Expected owned paths:

- `src/tools/catalog/**`
- `src/tools/registry/**`
- `src/application/tools/**` or equivalent narrow application adapters
- M4 composition and focused unit/integration tests
- ADR-0031 evidence and this tracker

Exit evidence:

- immutable catalog has unique deterministic definitions and availability;
- read registry has no mutation lookup/invocation surface;
- active read/analysis tools call typed application ports without an LLM;
- future manifest entries remain non-executable;
- read/analysis integration proves byte-identical SQLite and zero audit writes;
- focused tests, typecheck and formatting pass;
- focused ADR-0031 changes are complete and await the orchestrating agent's scoped
  commit.

### Session 3 — ADR-0032 executor and result envelope

Status: Completed

Expected owned paths:

- `src/tools/execution/**`
- tool result/output schemas and safe error mapping
- focused execution/envelope tests
- ADR-0032 evidence and this tracker

Exit evidence:

- fixed input → precondition → handler → output → envelope sequence;
- invalid input cannot call handler;
- success/failure envelopes and stable error families are exact and JSON-safe;
- malformed handler output and thrown exceptions fail safely without private leaks;
- focused tests, typecheck and formatting pass;
- focused ADR-0032 changes are complete and await the orchestrating agent's scoped
  commit.

### Session 4 — ADR-0033 mutation authorization and proposal boundary

Status: Completed

Expected owned paths:

- mutation/proposal contract and registry modules
- authorization binding/digest helpers or ports
- focused authorization/no-mutation scenario tests
- ADR-0033 evidence and this tracker

Exit evidence:

- confirmation variants are exclusive and strict;
- mutation invocation requires trusted context outside provider-visible arguments;
- missing, expired, mismatched, replayed and mutated-payload contexts call no handler;
- valid fake proposal/direct-fact contexts call exactly one fake handler;
- production M4 composition remains deny-by-default and exposes no mutation tools to AI;
- focused tests, typecheck and formatting pass;
- focused ADR-0033 commit created.

### Session 5 — Integration, documentation and milestone gates

Status: Completed

Expected owned paths:

- `docs/ARCHITECTURE.md`, `docs/TOOLS.md`, `docs/TESTING.md`
- `README.md`, `CHANGELOG.md`, package exports as required
- ADR implementation evidence and this tracker

Exit evidence:

- all documents describe implemented behavior, not future behavior;
- no schema migration or canonical campaign-state impact;
- `pnpm check`, milestone-specific tests and `git diff --check` pass;
- complete base-to-head stabilization review passes;
- scoped commits are pushed and PR is opened without starting M5.

### Session 6 — CI/security/Codex review and human handoff

Status: In progress

Exit evidence:

- CI/security checks terminal and green on current head;
- current-head Codex review is verified;
- findings are validated and presented as one remediation proposal;
- no review-driven edits occur without explicit owner approval;
- after any approved remediation, gates/review are repeated;
- final handoff requests human approval and does not merge the PR.

## Decision-to-code matrix

| ADR  | Controlling decision                                      | Planned evidence                                             |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 0030 | JSON Schema normative; strict Zod mirrors and drift tests | pair discovery, shared corpus, no coercion/extra keys        |
| 0031 | immutable catalog and separate capability registries      | API separation, unique catalog, direct read/analysis calls   |
| 0032 | one schema-first executor and stable safe envelopes       | exact errors, output validation, redaction, JSON safety      |
| 0033 | confirmation claim plus out-of-band bound authorization   | mismatch/expiry/replay tests and deny-by-default composition |

## State and migration impact

- Planned SQLite schema changes: none.
- Planned migrations: none.
- Planned canonical campaign writes during M4 tools: none in production composition.
- Read/analysis verification must use sanitized temporary databases.
- Mutation contract tests use spies/fakes; concrete M6 campaign mutations are deferred.

## Test/evidence log

| Date       | Session | Command/evidence                                                                         | Result                                                                   |
| ---------- | ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-09-01 | 0       | Repository safety checks                                                                 | Clean except four expected untracked proposed ADRs; branch/base recorded |
| 2026-09-01 | 0       | Scoped Prettier write and `git diff --check`                                             | Passed for accepted ADRs and tracker                                     |
| 2026-09-01 | 1       | `node node_modules/vitest/vitest.mjs run tests/unit/tools/tool-contract-parity.test.ts`  | Passed: 1 file / 64 tests (outside sandbox after `spawn EPERM`)          |
| 2026-09-01 | 1       | `node node_modules/typescript/bin/tsc --noEmit`                                          | Passed                                                                   |
| 2026-09-01 | 2       | `node node_modules/vitest/vitest.mjs run tests/unit/tools/read-tool-registry.test.ts`    | Passed outside sandbox after `spawn EPERM`: 1 file / 4 tests             |
| 2026-09-01 | 2       | M3 inspection/application plus M4 read-registry Vitest regression                        | Passed outside sandbox: 3 files / 32 tests                               |
| 2026-09-01 | 2       | Scoped Prettier, ESLint and `node node_modules/typescript/bin/tsc --noEmit`              | Passed                                                                   |
| 2026-09-01 | 3       | Executor, contract parity, read registry and M3 inspection/application Vitest regression | Passed outside sandbox after `spawn EPERM`: 5 files / 143 tests          |
| 2026-09-01 | 3       | Scoped Prettier, ESLint and `node node_modules/typescript/bin/tsc --noEmit`              | Passed                                                                   |
| 2026-09-09 | 4       | Mutation/proposal registry, authorization, parity and executor Vitest regression          | Passed outside sandbox: 4 files / 134 tests                              |
| 2026-09-09 | 4       | `node node_modules/typescript/bin/tsc --noEmit` and scoped Prettier                       | Passed                                                                   |
| 2026-09-09 | 5       | `pnpm check`                                                                              | Passed: formatting, lint, typecheck, 45 files / 404 tests, build, production smoke |
| 2026-09-09 | 5       | Independent base-to-head stabilization review                                             | Three P2 findings verified: two slot semantics defects and insufficient recursive parity evidence |
| 2026-09-09 | 5       | Focused slot/parity regression                                                            | Passed: 2 files / 98 tests                              |
| 2026-09-09 | 5       | `pnpm check` after stabilization remediation                                              | Passed: formatting, lint, typecheck, 45 files / 406 tests, build, production smoke |
| 2026-09-09 | 6       | Codex review on `6d6532e`                                                                | One valid P1: unscoped illithid acquisition collapsed unknown to false |
| 2026-09-09 | 6       | Focused illithid/parity regression                                                       | Passed: 2 files / 98 tests                              |
| 2026-09-09 | 6       | `pnpm check` after P1 remediation                                                        | Passed: formatting, lint, typecheck, 45 files / 406 tests, build, production smoke |
| 2026-09-09 | 6       | Owner approval for parity P2 remediation                                                 | Explicitly accepted in the Codex task                   |
| 2026-09-09 | 6       | Focused parity/read registry regression after P2                                         | Passed: 2 files / 99 tests                              |
| 2026-09-09 | 6       | `pnpm check` after P2 remediation                                                        | Passed: formatting, lint, typecheck, 45 files / 407 tests, build, production smoke |
| 2026-09-09 | 6       | Positive full-value/union/default parity regression                                      | Passed: 1 file / 137 tests                             |
| 2026-09-09 | 6       | `pnpm check` after positive parity remediation                                           | Passed: formatting, lint, typecheck, 45 files / 451 tests, build, production smoke |
| 2026-09-09 | 6       | CI Quality gates and GitGuardian on remediated PR                                        | Passed on the latest material code and documentation checkpoint |
| 2026-09-09 | 6       | Current-material-head independent AI review (`main...d4e0a1f`)                            | No P0-P2; one tracker-only P3 corrected in `aaddcd2`    |
| 2026-09-09 | 6       | Codex review on `aaddcd2`                                                                | Three valid P2: ability/spell verification metadata and protected story candidates |
| 2026-09-09 | 6       | Focused read/parity regression for three P2 findings                                     | Passed: 2 files / 145 tests                             |
| 2026-09-09 | 6       | `pnpm check` after three-P2 remediation                                                  | Passed: formatting, lint, typecheck, 45 files / 453 tests, build, production smoke |
| 2026-09-09 | 6       | Owner approval for array-form type-union parity remediation                              | Explicitly accepted in the Codex task                   |
| 2026-09-09 | 6       | Focused parity/read registry regression for array-form unions                            | Passed: 2 files / 146 tests                             |
| 2026-09-09 | 6       | `pnpm check` after array-form union remediation                                          | Passed: formatting, lint, typecheck, 45 files / 454 tests, build, production smoke |
| 2026-09-09 | 6       | Codex review on `9d97525`                                                                | Two valid P2: UNKNOWN candidates and throwing error mapper containment |
| 2026-09-09 | 6       | Focused executor/read regressions                                                        | Passed: 2 files / 31 tests                              |
| 2026-09-09 | 6       | `pnpm check` after two-P2 remediation                                                    | Passed: formatting, lint, typecheck, 45 files / 456 tests, build, production smoke |

## Commit and PR log

| Session | Commit/PR | Status                     |
| ------- | --------- | -------------------------- |
| 0       | `fa2334f` | ADR acceptance and tracker |
| 1       | `2f73dc9` | ADR-0030 implementation    |
| 2       | `a2cd9ce` | ADR-0031 implementation    |
| 3       | `c69c9d6` | ADR-0032 implementation    |
| 4       | `790791e` | ADR-0033 implementation    |
| 5       | `b2ca72b` | integration/docs/gates     |
| 6       | `9d97525` / PR #7 | Latest review findings remediated locally; commit/push pending |

## Risks and active questions

- Output DTO breadth must remain bounded and must reuse M3 semantics without coupling
  tools to CLI envelopes.
- `find_equipment_candidates` must not invent M14 tags/scores.
- Existing future-facing schemas must not accidentally activate M6–M9 capabilities.
- M6 still owns durable proposal representation, expiry and atomic consumption/retry.

No blocking question is currently open.

## Resume point

Session 6 is active on PR #7. Codex review of `9d97525` returned two valid P2 findings;
the owner authorized necessary remediation. `UNKNOWN` inventory is now excluded from
automatic equipment candidates and throwing error mappers are contained as redacted
`INTERNAL_ERROR` results. Focused tests pass 31/31 and the full 456-test gate is green.
Commit/push, sweep, CI and current-head review remain. Do not merge and do not start M5.

## Change log

- 2026-09-01 — Created tracker after explicit acceptance of ADR-0030 through ADR-0033.
- 2026-09-01 — Completed Session 0 approval/tracking gate and opened Session 1.
- 2026-09-01 — Completed Session 1 with 30 JSON/Zod pairs and 64 focused parity tests;
  opened Session 2.
- 2026-09-01 — Completed Session 2 with the 13-tool read/analysis catalog, atomic
  application projections, read-only composition and 4 focused registry/integration
  tests; opened Session 3.
- 2026-09-01 — Completed Session 3 with 13 normative output DTO contracts, stable safe
  envelopes, schema-first asynchronous execution, bounded diagnostics and 143 focused
  executor/parity/registry/regression tests; opened Session 4.
- 2026-09-09 — Resumed from the Session 4 checkpoint after the delegated agent reached
  its usage limit; preserved and reviewed all partial changes.
- 2026-09-09 — Completed Session 4 with separate proposal/mutation registries, strict
  receipts, versioned payload authorization binding and 134 focused tests; opened
  Session 5.
- 2026-09-09 — Stabilization excluded unknown-slot items from compatibility claims,
  rejected explicit candidate/slot conflicts, expanded parity evidence across nested
  boundaries and unsupported keywords, and passed the full 406-test milestone gate.
- 2026-09-09 — Committed Session 5 as `b2ca72b`, pushed the branch and opened PR #7;
  moved to Session 6 for CI/security and current-head Codex review.
- 2026-09-09 — Codex reviewed current head `6d6532e` and reported one valid P1: an
  unscoped illithid query emitted false acquisition facts. Owner authorized necessary
  continuation; remediation changes the unscoped value to unknown (`null`) while
  preserving booleans for character-scoped queries.
- 2026-09-09 — Committed and pushed P1 remediation as `44cff86`. The repeated
  stabilization sweep confirmed the functional fix and identified a P2 parity-test
  blind spot for the nullable boolean representation plus a stale resume checkpoint.
- 2026-09-09 — Owner explicitly accepted the P2 remediation. Switched nullable boolean
  JSON Schema to the supported `anyOf` representation, made union-negative generation
  reject only values invalid for the whole union, added direct parity regression and
  passed the full 407-test gate.
- 2026-09-09 — Committed and pushed nullable-union remediation as `0a29635`. The next
  sweep found missing positive full-value/union/default coverage; owner explicitly
  accepted the follow-up P2 remediation.
- 2026-09-09 — Implemented the accepted positive parity matrix; focused parity passed
  137 tests and the full milestone gate passed 451 tests.
- 2026-09-09 — Committed and pushed the positive parity matrix as `d4e0a1f`; fresh
  stabilization found no P0-P2 findings and only refreshed this durable checkpoint.
- 2026-09-09 — Pushed tracker-only checkpoint `aaddcd2`; hosted Quality gates and
  GitGuardian passed. External Codex did not return a current-head review after a repeat
  request, so the no-P0-P2 independent review of material head `d4e0a1f` is recorded as
  the workflow fallback. M4 is ready for human approval without merging.
- 2026-09-09 — Delayed Codex review for `aaddcd2` returned three valid P2 findings. The
  owner explicitly requested they be addressed; Session 6 reopened for verified
  remediation and another complete review cycle.
- 2026-09-09 — Preserved ability/spell verification status and excluded another
  character's protected story items from automatic equipment candidates; focused tests
  passed 145 and the full gate passed 453.
- 2026-09-09 — Pushed the three fixes as `4a604c1`. Stabilization confirmed them and
  found an array-form type-union parity blind spot; owner explicitly accepted generalized
  harness support and representative regressions.
- 2026-09-09 — Implemented array-form union validation plus positive/negative branch
  generation; focused tests passed 146 and the full gate passed 454.
- 2026-09-09 — Committed and pushed the array-form union remediation as `9a019a2`; fresh
  cumulative stabilization found no P0-P2 findings and advanced to final CI/review.
- 2026-09-09 — Codex review of `9d97525` returned two valid P2 findings. Excluded
  `UNKNOWN` rows from automatic equipment candidates and contained throwing error
  mappers; focused tests passed 31 and the full gate passed 456.
