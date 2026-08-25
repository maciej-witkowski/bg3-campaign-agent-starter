# ADR-0014: Transactional domain mutations, validation and audit

Status: Proposed

Milestone: M1 — Canonical Campaign Database

## Context and problem statement

M1 must provide repositories and transactional domain services while guaranteeing that every successful mutation is valid and audited, and every failed operation leaves no partial state. SQLite transactions alone do not decide where writes are allowed, when validation runs or how audit coverage is made unavoidable.

ADR-0004 prohibits models and UI from using arbitrary SQL. ADR-0008 requires append-only audit events with before/after state. The design must turn those rules into one mandatory mutation path rather than a convention each service may accidentally bypass.

## Decision drivers and invariants

- All campaign writes go through typed domain services.
- A logical domain operation is one transaction and one root audit event.
- Validation runs after proposed writes and before commit.
- Invalid state, audit failure or thrown domain error rolls back everything.
- Read-only recommendations never enter the mutation coordinator.
- Audit history is append-only; reversal creates a new event.
- Error results identify invariant violations without leaking SQL or private full-state snapshots.
- Tests can inject a deterministic clock and ID source.

## Considered options

### Option A — Mandatory application transaction coordinator used by typed domain services

The coordinator owns transaction start, before snapshot, service callback, validation, after snapshot, audit insert and commit/rollback. Mutation-capable repositories are scoped to its callback.

### Option B — Let each repository method open its own transaction and audit itself

This makes multi-repository operations non-atomic and spreads invariant/audit policy across persistence methods.

### Option C — Use SQLite triggers for audit and campaign validation

Triggers can enforce some local constraints but cannot express domain intent, Polish summaries or typed violations cleanly. They also risk hiding behavior from domain tests.

### Option D — Expose a generic transaction callback publicly

This makes batching convenient but is equivalent to exposing a general write escape hatch outside typed services.

### Option E — Add repositories without mutation orchestration

The status quo fails the M1 rollback and audit requirements.

## Proposed decision and rationale

Implement a mandatory `CampaignMutationCoordinator` (name may be refined without changing the decision) used by every typed M1 mutation service.

For one logical service call it will, within one SQLite transaction:

1. allocate or accept deterministic operation metadata (event ID, timestamp, type, Polish summary, optional reason and related entity IDs);
2. serialize the canonical campaign state before the operation;
3. invoke the typed service operation with transaction-scoped write repositories;
4. run `validateCampaignState()` against the uncommitted transaction state;
5. serialize the canonical campaign state after the operation;
6. insert exactly one immutable root `change_events` row containing the metadata and before/after snapshots;
7. commit only if every step succeeds.

Any exception causes SQLite rollback and is translated at the domain boundary into a typed domain, validation or persistence error. No catch block may convert a failed write into success.

`validateCampaignState()` returns a deterministic list of structured violations and has a throwing wrapper for mutation commits. Violation records contain a stable code, relevant entity IDs and a safe Polish/technical message. At minimum M1 validation covers:

- equipment instance and character-slot uniqueness;
- agreement between equipment, inventory status, owner and known item slot;
- prohibition of equipped chest/sold/non-equipped states;
- positive inventory quantity;
- base attributes plus active permanent modifiers as the only effective-value calculation;
- complete permanent-modifier target and provenance;
- valid spell preparation relationships;
- referential and join-table consistency not fully expressed by foreign keys.

Database constraints remain the first structural defense. The validator does not silently repair data and does not replace foreign-key or uniqueness constraints.

Repositories are split by capability:

- read repositories may be used by queries and validation;
- mutation methods are available only through the transaction-scoped context passed to typed domain services;
- the native SQLite connection, unrestricted Drizzle database and generic write callback are not exported to adapters, tools or models.

M1 provides typed services for the M1 aggregates: character/attribute state, permanent modifiers, definitions and effects, inventory/equipment, character spell/ability/power assignments and checkpoint creation. It does not expose a generic patch service or later proposal/confirmation semantics.

For a batch that represents one user/domain intent, all affected rows share one transaction and one audit event. Separate service calls create separate events. A no-op mutation request is rejected or returns an explicit unchanged result and does not create a misleading successful change event.

Reversal semantics are append-only: a reversal operation creates a new event with `reverses_change_event_id` pointing to the prior event. M1 establishes the representation and transactional capability; user-facing undo orchestration remains in M6.

## Boundaries and dependency direction

- Domain services own operation meaning and call the coordinator.
- The coordinator owns the transaction protocol and depends on snapshot serialization, validation and persistence ports.
- Repositories implement persistence ports and do not decide user intent.
- Validation reads through a transaction-scoped state reader.
- Adapters/tools/models can receive typed domain service interfaces only.
- No domain module imports a UI, model provider or research module.

## Data, migration and compatibility impact

- `change_events` stores immutable event identity, UTC occurrence time, operation type, Polish summary, optional reason/related IDs, optional reversal reference and versioned before/after JSON.
- Existing event rows are never updated or deleted to indicate reversal; reversal state is derived from later referencing events.
- The initial schema has no pre-M1 events to migrate.
- Domain-service API changes after M1 must preserve the mandatory coordinator path or receive a new ADR.

## Transaction, validation, audit and rollback impact

This ADR is the controlling decision for write ordering. Validation and audit insertion occur before commit in the same transaction as state writes. Audit insertion failure rolls back state. Validation failure rolls back state and creates no successful audit event in the canonical database.

Failed attempts may be returned to the caller or logged safely outside canonical audit history, but M1 will not add a second writable truth store for them.

The before/after serializer excludes audit events and checkpoints as historical metadata, preventing recursive snapshots. Snapshot scope and format are defined by ADR-0015.

## Security, privacy and external-data impact

- No arbitrary SQL or generic write interface crosses the persistence/domain boundary.
- Errors omit raw SQL and full private snapshots by default.
- Audit snapshots remain inside the private local SQLite database.
- M1 domain services accept application data only; no external research is trusted or executed.
- Sanitized fixtures are used for tests.

## Required tests and operational evidence

- Successful mutations create exactly one root audit event with matching before/after state.
- Multi-row equipment changes are atomic.
- Validation failure after one or more writes rolls back all state and the audit insert.
- Injected repository, validator, serializer and audit-insert failures each prove rollback.
- Direct uniqueness/check/foreign-key failures prove rollback and safe error translation.
- A no-op request does not create a misleading change event.
- A reversal creates a new referencing event and does not update/delete the earlier event.
- Read-only repository calls produce zero audit and state writes.
- Tests prove mutation repositories/native connections are not exposed through the public adapter-facing API.
- Deterministic clock/ID injection makes audit assertions stable.

## Consequences and trade-offs

- One coordinator makes the critical write sequence auditable and difficult to bypass.
- Full-state before/after snapshots are simple and reliable for a single local campaign, but cost more storage than row-level diffs.
- Typed services require more code than generic repository writes.
- Application validation duplicates a small amount of database constraint logic, improving diagnostics and defense in depth.
- Failed attempts are not canonical audit events, so operational logs may be needed later for diagnostics without becoming campaign truth.

## Rejected alternatives

- Per-repository transactions are rejected because they cannot guarantee aggregate atomicity.
- Trigger-only validation/audit is rejected because it obscures domain intent and cannot provide the required typed service boundary.
- A public generic mutation callback is rejected as an arbitrary-write escape hatch.
- Creating audit events after commit is rejected because audit failure could leave an unaudited state mutation.
- Updating an earlier audit row during reversal is rejected by append-only ADR-0008.
- M6 proposal/confirmation logic is rejected from M1 scope.

## Unresolved questions

None blocking. Domain service method granularity may be refined during implementation as long as every public mutation remains typed and follows this protocol. A materially different audit/snapshot scope requires a new proposed ADR.

## Approval record

Pending explicit user approval.

## Change log

- 2026-08-26 — Initial M1 proposal.
