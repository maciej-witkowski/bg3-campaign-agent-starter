# BG3 Campaign Agent — Specification

Status: living specification
Version: 0.1.0
Language of campaign data: Polish
Implementation language: TypeScript

## 1. Product mission

BG3 Campaign Agent is a persistent, local-first assistant for one Baldur's Gate 3 campaign. Its purpose is to preserve canonical campaign state across months of play and help with character development, equipment, spells, merchants, loot, illithid powers, build synergies, and reversible campaign-state changes.

The core design principle is:

> The model is not campaign memory. The database is campaign memory.

A model, chat session, UI, or implementation may change. The campaign state must remain reliable and auditable.

## 2. Primary use cases

The application must support:

- reading current party state;
- level-up and respec analysis;
- spell, cantrip, feat, invocation, maneuver and class-feature tracking;
- illithid power-tree tracking;
- merchant analysis without falsely adding unpurchased items;
- adding newly obtained loot;
- equipment comparison with explicit opportunity cost;
- synergy analysis across the whole party and chest inventory;
- permanent attribute modifiers with provenance;
- item identity resolution between Polish UI names and verified English aliases;
- voice input and voice output;
- later screenshot/vision extraction of Polish item tooltips;
- explicit proposal-versus-commit workflow;
- checkpointing, audit history and rollback;
- export to XLSX/JSON for human inspection.

## 3. Non-goals for early versions

Until explicitly added by roadmap milestone, the system does not need:

- autonomous gameplay;
- mouse/keyboard control of Baldur's Gate 3;
- automated save-file modification;
- always-listening wake-word support;
- a mathematically complete BG3 combat simulator;
- cloud-hosted canonical campaign state;
- multi-user collaboration.

## 4. Canonical sources of truth

Priority order for campaign facts:

1. canonical SQLite database;
2. exact values read by the user from the Polish game UI and explicitly confirmed;
3. verified local knowledge records;
4. validated external research;
5. model inference.

Model inference must never silently become canonical data.

## 5. Architectural invariants

1. SQLite is the only writable canonical state store.
2. AI models never receive unrestricted SQL execution.
3. UI code never directly mutates SQLite.
4. All writes go through typed domain services/tools.
5. Every state mutation is transactional.
6. Every successful state mutation creates an audit event.
7. Validation runs before commit.
8. Recommendation and mutation are separate operations.
9. Merchant items are temporary until explicitly purchased.
10. Unknown values remain unknown; do not guess.
11. Polish names are canonical identifiers for user-facing game entities.
12. English aliases require verified resolution metadata.
13. External web data is untrusted until reconciled with campaign/UI data.
14. Equipped, chest, personal/story, situational and sold states are mutually exclusive.
15. Backups and snapshots are first-class features, not optional utilities.

## 6. Recommended technology stack

- Node.js 22+
- TypeScript, strict mode
- pnpm
- SQLite
- Drizzle ORM
- Zod
- Vitest
- ESLint + Prettier
- OpenAI Responses API for reasoning/tool workflows
- OpenAI Realtime API for low-latency voice sessions
- optional OpenAI Agents SDK if it reduces orchestration complexity; do not couple domain logic to it
- Tauri preferred for desktop shell; Electron allowed by ADR if needed
- Git for source and documentation

All model names must be configuration values, never hard-coded architectural assumptions.

## 7. High-level runtime architecture

```text
User
  │
  ├── CLI/text
  ├── push-to-talk audio
  └── screenshot (later)
  │
Input adapters
  │
Intent router
  │
Campaign agent / reasoning layer
  │
Typed tools
  ├── read/query domain
  ├── analysis helpers
  ├── research/verification
  └── controlled mutations
  │
Domain services
  │
SQLite + audit log + snapshots
```

## 8. Proposal/commit protocol

The system must distinguish:

### Analysis statement
"Może warto dać ten pierścień Lae'zel."

Result: analysis only. No state mutation.

### Explicit factual update
"Kupiłem ten pierścień. Dodaj go do skrzyni."

Result: mutation is allowed because the user directly states new campaign state.

### Explicit confirmation
"Tak, zatwierdzam zmianę."

Result: apply the latest unambiguous proposal through domain mutation tools.

Ambiguous language must not mutate state.

## 9. Language and item identity

- All canonical display names are stored in Polish.
- Normalized Polish names may be used for matching, but never replace original display text.
- English aliases are optional metadata.
- The item resolver must use names + item type + rarity + effects, not simple translation alone.
- If confidence is below the configured threshold, request user confirmation.
- User-provided Polish tooltip effects outrank conflicting web descriptions for the current campaign.

## 10. Required documentation

The repository must keep the following documents current:

- `SPECIFICATION.md`
- `AGENTS.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DOMAIN_RULES.md`
- `docs/TOOLS.md`
- `docs/ITEM_RESOLUTION.md`
- `docs/VOICE.md`
- `docs/DECISION_PROTOCOL.md`
- `docs/TESTING.md`
- `docs/SECURITY.md`
- `docs/PROMPTING.md`
- `docs/OPERATIONS.md`
- ADR records under `docs/adr/`

## 11. Required quality gates

Before any milestone is considered complete:

- TypeScript typecheck passes;
- lint passes;
- unit tests pass;
- relevant scenario tests pass;
- schema validation passes;
- migration tests pass for database changes;
- no silent campaign-state mutation occurs during read-only workflows;
- documentation impacted by the change is updated;
- CHANGELOG records milestone completion.

## 12. Reliability target

The application prioritizes state correctness over conversational convenience. If the system detects conflicting canonical data, it must surface the conflict and avoid committing a mutation until it is resolved.

## 13. Incremental delivery

Implement only one roadmap milestone at a time. Codex tasks must explicitly prohibit speculative implementation of later milestones unless a prerequisite refactor is strictly necessary and documented.
