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

Before coding:

1. Identify the exact roadmap milestone/task.
2. Inspect existing implementation and tests.
3. State assumptions in the task output if the specification leaves ambiguity.

After coding:

1. run formatting;
2. run lint;
3. run typecheck;
4. run unit tests;
5. run integration/scenario tests relevant to the change;
6. update affected docs;
7. update `CHANGELOG.md`;
8. report unresolved risks.

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
