# AGENTS.md — BG3 Campaign Agent

This file is the short operational map for coding agents. Read `SPECIFICATION.md` first, then the documents linked below.

## Mission

Build a reliable persistent BG3 campaign assistant. Correctness of campaign state is more important than convenience, speed, or cleverness.

## Required reading before changes

- `SPECIFICATION.md`
- `ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DOMAIN_RULES.md`
- `docs/MILESTONE_DELIVERY_WORKFLOW.md`
- relevant ADRs in `docs/adr/`

For AI behavior changes also read:

- `docs/TOOLS.md`
- `docs/DECISION_PROTOCOL.md`
- `docs/PROMPTING.md`

For voice work also read `docs/VOICE.md`.

## Non-negotiable architecture rules

1. SQLite is the only writable source of truth.
2. UI and models never write arbitrary SQL.
3. All writes go through typed domain services.
4. All mutations are transactional.
5. Every mutation creates an audit event.
6. Campaign validation runs before commit.
7. Recommendations never mutate state.
8. Unknown data stays unknown.
9. Polish game names are canonical user-facing identifiers.
10. Never silently resolve conflicts between game-provided data and external research.

## Development workflow

Every request to implement a numbered milestone must follow `docs/MILESTONE_DELIVERY_WORKFLOW.md` end to end.

The first implementation gate is mandatory: create detailed milestone ADRs with status `Proposed`, present them to the user and wait for explicit approval. Do not write implementation code, schemas, migrations or runtime dependencies before approval. Mark approved ADRs `Accepted` and keep them current throughout implementation. Any new or materially changed architectural decision requires a new proposed ADR and renewed user approval.

Unless the user explicitly requests a smaller stopping point, milestone delivery includes a dedicated branch, scoped commits, a pull request, green CI/security checks, AI review, remediation of valid findings and a final request for human approval. It never includes merging the pull request without explicit user instruction.

## Database changes

Any schema change requires:

- a migration;
- updated `docs/DATA_MODEL.md`;
- repository/domain updates;
- migration tests;
- state validation coverage;
- no destructive rewrite of existing campaign data unless explicitly specified.

## Agent behavior changes

Any change to recommendation/mutation behavior requires at least one scenario regression test.

## Scope discipline

Do not implement later roadmap milestones automatically. Finish the requested milestone, validate it, and stop.
