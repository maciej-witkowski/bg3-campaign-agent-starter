# Roadmap

Each milestone must be implemented independently. Do not start the next milestone until the current milestone passes its exit criteria.

## M0 — Repository Foundation

### Goal
Create a production-quality TypeScript repository skeleton with no AI or campaign logic.

### Deliverables
- Node.js 22+ and pnpm project.
- strict TypeScript.
- ESLint and Prettier.
- Vitest.
- environment configuration loader validated with Zod.
- source/test directory structure.
- CI workflow running lint, typecheck and tests.
- ADR tooling/convention documented.
- package scripts documented.

### Exit criteria
- clean install from fresh clone;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass;
- no OpenAI SDK integration yet;
- no database schema yet.

---

## M1 — Canonical Campaign Database

### Goal
Implement canonical SQLite state model and transactional domain services.

### Deliverables
- Drizzle + SQLite setup.
- schema for characters, attributes, permanent modifiers, item definitions, item effects, inventory instances, equipment, spells, character spells, abilities, illithid powers, change events and checkpoints.
- migrations.
- repositories.
- transaction helper.
- `validateCampaignState()`.
- audit event creation.
- checkpoint/snapshot serialization primitives.

### Required invariants
- one equipped item instance cannot be in two slots;
- equipped item cannot also be chest/sold;
- effective attributes derive from base + modifiers;
- permanent modifier always stores provenance;
- mutation services create audit events;
- invalid state rolls back.

### Exit criteria
- migration from empty DB works;
- rollback tests pass;
- invariant violation tests pass;
- DATA_MODEL docs updated.

---

## M2 — Import Existing Campaign Tracker

### Goal
Import `BG3_Campaign_Tracker.xlsx` into SQLite without duplicates or silent guesses.

### Deliverables
- XLSX parser/importer.
- deterministic normalization helpers.
- import report: inserted, matched, skipped, ambiguous, conflicts.
- idempotent re-import.
- reconciliation file for uncertain fields.
- exporter back to XLSX/JSON.

### Rules
- Polish names preserved exactly.
- `DO WERYFIKACJI` stays unverified.
- import never invents English aliases.
- duplicate identical inventory definitions merge only under explicit rules.

### Exit criteria
- importing same XLSX twice produces same DB state;
- all active characters and equipped items are represented;
- Lae'zel permanent +2 STR provenance preserved;
- report lists unresolved fields.

---

## M3 — Read-Only CLI

### Goal
Provide reliable local inspection without AI.

### Commands
- `party`
- `character <name>`
- `equipment <name>`
- `inventory [--slot] [--status] [--tag]`
- `spells <name>`
- `illithid [name]`
- `changes [--limit]`
- `validate`
- `export`

### Exit criteria
- all commands are read-only except export;
- output has stable machine-readable JSON option;
- CLI integration tests pass.

---

## M4 — Typed Tool Layer

### Goal
Expose domain operations as strongly typed tool contracts independent of OpenAI.

### Deliverables
- Zod schemas corresponding to `schemas/tools/*.schema.json`.
- tool registry.
- typed result envelopes.
- read/query tools.
- proposal types.
- mutation tools requiring explicit confirmation token/context.

### Exit criteria
- tools can be called from tests without an LLM;
- invalid inputs fail before domain logic;
- mutation tools cannot be accidentally called through read-only interface.

---

## M5 — AI Read-Only Campaign Agent

### Goal
Add Responses API reasoning with read-only campaign tools.

### Supported intents
- party status;
- compare equipment;
- analyze new item;
- merchant analysis;
- level-up recommendations;
- spell/feat comparison;
- illithid recommendation.

### Hard restriction
No mutation tools exposed to model in this milestone.

### Exit criteria
- context builder retrieves only relevant campaign data;
- model does not receive whole DB by default;
- scenario tests confirm recommendations do not mutate state;
- model/provider configuration is environment-driven.

---

## M6 — Controlled Mutations + Confirmation

### Goal
Allow the agent to commit user-approved changes safely.

### Deliverables
- proposal store with short-lived IDs.
- explicit confirmation resolver.
- `equip_item`, `move_to_chest`, `add_owned_item`, `mark_sold`, spell preparation, ability addition, permanent modifier and illithid unlock tools.
- pre/post snapshots.
- audit logs.
- undo last confirmed change.

### Confirmation rules
- suggestion language does not count;
- direct factual updates may mutate if unambiguous;
- confirmation must refer to one resolvable proposal;
- ambiguous confirmation triggers clarification.

### Exit criteria
- all mutation scenarios pass;
- recommendation-only scenarios prove zero DB writes;
- rollback restores valid previous state.

---

## M7 — Polish Item Resolver

### Goal
Resolve Polish game entities without hallucinated translations.

### Resolution pipeline
1. exact canonical Polish match;
2. normalized Polish alias;
3. verified alias map;
4. fuzzy candidate generation;
5. effect/type/rarity matching;
6. optional external research;
7. confidence scoring;
8. user confirmation when required.

### Deliverables
- resolver service;
- alias store;
- confidence model;
- conflict model;
- resolution audit trail.

### Exit criteria
- low-confidence resolution never silently commits alias;
- known regression examples resolve correctly;
- identical Polish names with distinct rarity/effects can coexist.

---

## M8 — External Research / Mechanics Verification

### Goal
Use web research as a controlled verification subsystem.

### Deliverables
- provider interface for web/search sources;
- source citations stored in research results;
- reconciliation against user-confirmed UI text;
- cache with timestamps;
- stale-source handling.

### Rules
- campaign data outranks external web data;
- contradiction is surfaced, never silently overwritten;
- web result does not automatically create item definition.

### Exit criteria
- researched claims preserve source URLs/metadata;
- conflict scenarios tested;
- no arbitrary network access outside research module.

---

## M9 — Merchant Session Workflow

### Goal
Handle items seen at a merchant without polluting inventory.

### Deliverables
- temporary merchant sessions;
- add candidate item by text;
- batch candidate analysis;
- rank S/A/B/C/D with rationale;
- purchase confirmation;
- purchased items transition into owned inventory.

### Exit criteria
- viewed-only merchant item never appears in chest;
- purchase statement correctly creates owned instance;
- partial purchase from batch works.

---

## M10 — Level-Up / Respec Workflow

### Goal
Provide structured class progression analysis and commit confirmed choices.

### Deliverables
- level-up session object;
- relevant build context loader;
- candidate choices and opportunity-cost analysis;
- staged spell preparation changes;
- confirmed commit into character/abilities/spells;
- full-party checkpoint after multi-character leveling.

### Exit criteria
- current build is always loaded before recommendation;
- no duplicate spell/function assumptions without checking DB;
- level-up proposal and commit are separate.

---

## M11 — Push-to-Talk Voice

### Goal
Add low-latency voice input/output without changing domain architecture.

### Deliverables
- Realtime API adapter;
- push-to-talk hotkey;
- partial/final transcript handling;
- intent routing;
- voice response;
- confirmation semantics for mutations;
- transcript audit metadata (not raw audio by default).

### Rules
- voice ambiguity cannot mutate state;
- destructive/high-impact state changes require clear confirmation;
- text UI mirrors what voice agent understood.

### Exit criteria
- voice can query state, analyze items and confirm an equipment proposal;
- accidental partial transcript does not mutate state;
- app remains usable without Realtime API.

---

## M12 — Desktop Tray Application

### Goal
Make the agent usable while BG3 is running.

### Deliverables
- Tauri tray app;
- push-to-talk shortcut configuration;
- small transcript/response overlay;
- current campaign indicator;
- offline status;
- safe exit and backup.

### Exit criteria
- no direct DB writes from UI;
- domain/agent tests reused unchanged;
- keyboard shortcut configurable.

---

## M13 — Screenshot Tooltip Capture

### Goal
Capture Polish item tooltips through an explicit hotkey and extract structured data.

### Deliverables
- selectable/remembered screen region;
- screenshot capture;
- vision extraction schema;
- confidence display;
- item resolver integration;
- explicit add/merchant flow.

### Exit criteria
- screenshot never automatically mutates inventory;
- uncertain OCR/vision fields are marked;
- user can correct extracted Polish text before commit.

---

## M14 — Synergy Engine

### Goal
Add deterministic pre-analysis features before LLM reasoning.

### Deliverables
- tags for damage types, concentration, GWM, crit, radiant orb, reverberation, arcane acuity, initiative, summon, control, etc.;
- candidate retrieval by role/slot/tags;
- opportunity-cost score;
- configurable heuristic score;
- explanation features exposed to model.

### Exit criteria
- deterministic score never overrides final reasoning silently;
- score components are inspectable;
- regression cases match expected candidate ranking direction.

---

## M15 — Campaign Initialization and Onboarding

### Goal
Provide a guided, validated way to begin a campaign from an empty database or adopt
the application during an already-running campaign without fabricating history.

### Scheduling rationale
This milestone is intentionally placed after the core text, mutation, resolver,
desktop and screenshot workflows because onboarding is useful but not a high-priority
dependency for them. It remains before long-term reliability work so M16 can harden,
back up and document the real onboarding paths. M14 is not a semantic prerequisite;
the ordering reflects product priority and avoids delaying core campaign features.

### Entry modes

#### New campaign
- default and recommended path;
- initialize an empty latest-schema database;
- capture the initial player/party characters and known baseline statistics;
- allow inventory, equipment, spells, abilities and illithid state to begin empty and
  grow through normal confirmed gameplay mutations;
- preserve unknown optional facts as unknown rather than requiring guesses.

#### Existing campaign
- stage current facts in reviewable batches for characters, attributes and permanent
  modifiers, owned/equipped items, travel-chest contents, spells, abilities and
  illithid powers;
- reuse M2 import/report concepts and the M7 resolver where applicable, without
  requiring the legacy tracker format;
- show inserted, matched, skipped, ambiguous and conflicting facts before commit;
- commit only explicit accepted batches through typed transactional services with
  validation and audit events;
- record onboarding provenance, but never invent prior gameplay chronology or audit
  events.

### Deliverables
- onboarding application workflow with explicit `NEW_CAMPAIGN` and
  `EXISTING_CAMPAIGN` modes;
- CLI and desktop entry points using the same application contract;
- bounded batch templates/contracts for all M1 current-state aggregates;
- preview, validation and reconciliation output before canonical writes;
- safe interruption/retry behavior and duplicate-resistant repeated submissions;
- completion summary and initial checkpoint after successful onboarding;
- Polish-language operator guidance for both entry modes.

### Rules
- SQLite remains the only writable canonical source of truth.
- Onboarding never overwrites a different non-empty campaign.
- UI, model and import adapters never write arbitrary SQL.
- Every accepted canonical batch is transactional, validated and audited.
- Unknown facts remain unknown and unresolved identities block their dependent writes.
- New-campaign onboarding must stay usable without AI, web research, screenshots or a
  pre-existing workbook.
- Existing-campaign onboarding may use item resolution or screenshot extraction only
  through their established confidence and confirmation boundaries.

### Explicit non-goals
- general-purpose spreadsheet mapping;
- automatic BG3 save-file or process-memory parsing;
- reconstructing historical audit events from user recollection;
- replacing or merging an unrelated non-empty canonical database;
- cloud sync or multi-user/multi-campaign management;
- backup/restore rotation, which remains M16 scope.

### Exit criteria
- a fresh database can be initialized with a minimal valid party and empty optional
  collections, then updated through normal M6 mutations;
- a sanitized mid-campaign fixture can be entered in multiple batches and produces
  the expected characters, statistics, equipment and travel-chest state;
- ambiguous identity, conflicting slot and invalid derived-stat scenarios produce no
  partial canonical writes;
- retrying an accepted batch does not duplicate canonical facts or audit mutations;
- onboarding cannot fabricate past events or overwrite another campaign;
- CLI and desktop paths yield the same validated canonical result;
- onboarding documentation clearly recommends starting from zero when practical.

---

## M16 — Reliability / Evals / Long-Term Operations

### Goal
Harden the project for a full campaign and future playthroughs.

### Deliverables
- scenario/eval runner;
- bug-to-regression workflow;
- backup rotation;
- checkpoint browser;
- restore testing;
- DB integrity diagnostics;
- token/cost telemetry;
- model router by task class;
- onboarding recovery/runbook and migration guidance for future campaigns.

### Exit criteria
- restore from backup tested;
- complete campaign export/import round trip passes;
- model replacement does not require domain rewrite.

---

## Deferred / optional

- wake word;
- multi-campaign UI;
- cloud sync;
- automated combat simulation;
- game-memory/save parsing;
- computer control.
