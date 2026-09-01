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

Status: In progress

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
- focused ADR-0031 commit created.

### Session 3 — ADR-0032 executor and result envelope

Status: Pending

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
- focused ADR-0032 commit created.

### Session 4 — ADR-0033 mutation authorization and proposal boundary

Status: Pending

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

Status: Pending

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

Status: Pending

Exit evidence:

- CI/security checks terminal and green on current head;
- current-head Codex review is verified;
- findings are validated and presented as one remediation proposal;
- no review-driven edits occur without explicit owner approval;
- after any approved remediation, gates/review are repeated;
- final handoff requests human approval and does not merge the PR.

## Decision-to-code matrix

| ADR | Controlling decision | Planned evidence |
| --- | --- | --- |
| 0030 | JSON Schema normative; strict Zod mirrors and drift tests | pair discovery, shared corpus, no coercion/extra keys |
| 0031 | immutable catalog and separate capability registries | API separation, unique catalog, direct read/analysis calls |
| 0032 | one schema-first executor and stable safe envelopes | exact errors, output validation, redaction, JSON safety |
| 0033 | confirmation claim plus out-of-band bound authorization | mismatch/expiry/replay tests and deny-by-default composition |

## State and migration impact

- Planned SQLite schema changes: none.
- Planned migrations: none.
- Planned canonical campaign writes during M4 tools: none in production composition.
- Read/analysis verification must use sanitized temporary databases.
- Mutation contract tests use spies/fakes; concrete M6 campaign mutations are deferred.

## Test/evidence log

| Date | Session | Command/evidence | Result |
| --- | --- | --- | --- |
| 2026-09-01 | 0 | Repository safety checks | Clean except four expected untracked proposed ADRs; branch/base recorded |
| 2026-09-01 | 0 | Scoped Prettier write and `git diff --check` | Passed for accepted ADRs and tracker |
| 2026-09-01 | 1 | `node node_modules/vitest/vitest.mjs run tests/unit/tools/tool-contract-parity.test.ts` | Passed: 1 file / 64 tests (outside sandbox after `spawn EPERM`) |
| 2026-09-01 | 1 | `node node_modules/typescript/bin/tsc --noEmit` | Passed |

## Commit and PR log

| Session | Commit/PR | Status |
| --- | --- | --- |
| 0 | `fa2334f` | ADR acceptance and tracker |
| 1 | pending | ADR-0030 implementation |
| 2 | pending | ADR-0031 implementation |
| 3 | pending | ADR-0032 implementation |
| 4 | pending | ADR-0033 implementation |
| 5 | pending | integration/docs/gates |

## Risks and active questions

- Output DTO breadth must remain bounded and must reuse M3 semantics without coupling
  tools to CLI envelopes.
- `find_equipment_candidates` must not invent M14 tags/scores.
- Existing future-facing schemas must not accidentally activate M6–M9 capabilities.
- M6 still owns durable proposal representation, expiry and atomic consumption/retry.

No blocking question is currently open.

## Resume point

Session 2 (ADR-0031) is active. Implement the immutable catalog, capability-separated
read registry, atomic application projections and all 13 active read/analysis handlers.
Do not add an all-category registry or concrete mutation execution.

## Change log

- 2026-09-01 — Created tracker after explicit acceptance of ADR-0030 through ADR-0033.
- 2026-09-01 — Completed Session 0 approval/tracking gate and opened Session 1.
- 2026-09-01 — Completed Session 1 with 30 JSON/Zod pairs and 64 focused parity tests;
  opened Session 2.
