# Architecture

## Layers

### 1. Adapters
CLI, desktop UI, voice and screenshot adapters. They translate user input into application requests. They must not contain campaign business rules.

### 2. Agent orchestration
Intent routing, context building, model calls and tool exposure. The model sees typed capabilities, never the raw database connection.

### 3. Tool layer
Stable contracts used by the model and non-AI callers. Tools validate input/output and delegate to domain services.

### 4. Domain services
Own campaign invariants and mutation semantics. Equipment swaps, spell preparation, purchase commits and permanent modifiers are implemented here.

### 5. Persistence
SQLite repositories and migrations. This layer does not decide whether a recommendation is appropriate; it persists valid domain state.

M1 implements this boundary with `better-sqlite3` and Drizzle. The connection factory enables foreign keys, a bounded busy timeout, WAL for file-backed databases and full synchronous durability. Committed SQL migrations are the only schema evolution mechanism.

### 6. Research
External verification behind a provider interface. Research is advisory and cannot mutate campaign state directly.

## Dependency direction

Adapters → agent/tools → domain → repositories → SQLite.

Research may be called by resolver/agent, but must not bypass domain mutation rules.

## Context strategy

Do not pass all campaign data to the model. A context builder must load the minimum necessary subset for the current intent.

Example `COMPARE_ITEM` for Lae'zel should load:

- Lae'zel class/subclass/level/role;
- effective attributes and permanent modifiers;
- feats/manuevers relevant to damage/accuracy;
- current item in target slot;
- other equipment with synergy effects;
- candidate item;
- optionally party effects that materially change the comparison.

It should not load Gale's full spellbook unless the comparison depends on Gale.

## Model abstraction

Define interfaces for reasoning and realtime providers. Domain code must not depend on a specific model name.

## Failure philosophy

Prefer explicit failure over silent repair. If inventory state is contradictory, return a typed conflict and require reconciliation.

## Implemented M1 write path

All M1 writes enter through typed domain services and execute inside one SQLite transaction. The coordinator captures a deterministic before snapshot, invokes the transaction-scoped repository, validates the resulting campaign state, captures the after snapshot and appends one audit event before commit. A no-op creates neither state changes nor an audit event; domain, validation, persistence or audit failures roll the entire transaction back.

Checkpoint creation follows the same path. Its versioned JSON payload and SHA-256 digest are stored atomically with the checkpoint and audit event. Snapshots intentionally exclude audit events, checkpoints and migration metadata, and M1 does not implement restore or undo.

The UI, model and future tool adapters must receive typed services only. The raw SQLite connection, unrestricted SQL and transaction-scoped write repository are persistence internals.

## Implemented M2 import/export path

The legacy XLSX adapter stages an exact, bounded workbook profile without database access. Pure normalizers preserve Polish display text and produce typed facts, issues and skipped-source records. A supplied reconciliation document is strictly checked against the exact workbook digest and generated issue identities before its bounded decisions can alter staged values or planner classification. Entity-specific planners compare the resulting facts with a deterministic read-only SQLite state and produce a report, reconciliation document and immutable write plan.

Only an unblocked plan reaches the M1 mutation coordinator. Plan freshness is checked again inside the same SQLite transaction before any import write. All imported rows, validation and the single `CAMPAIGN_IMPORTED` audit event commit or roll back together. A repeated semantic import is a no-op with no new event.

Import plans are in-memory capabilities issued by one application-service instance. Issued plans are recursively frozen, and the service records a digest computed from a structured clone that cannot honor caller-supplied JSON serialization hooks. Copied or modified structural objects are refused before mutation. Planners also compare new assignments and equipment slots with rows already pending in the same plan, so conflicting composite identities become reconciliation conflicts rather than database constraint failures.

Current-state export captures and validates one transactionally consistent read snapshot before serializing JSON or XLSX. Invalid canonical state is refused rather than published as a portable campaign artifact.

The current-state XLSX profile has its own symmetric serialization/deserialization limits. These bounds are intentionally independent from the smaller legacy-tracker input profile and allow up to 100,000 data rows per canonical collection.

Current-state JSON and XLSX exporters capture the same 14 validated collections as M1 snapshots in a consistent read transaction. Export is read-only. The normalized exchange importer preserves stable IDs only in an empty database, treats an identical database as a no-op and refuses a different non-empty campaign. Complete audit/checkpoint backup and restore remain M15 scope.
