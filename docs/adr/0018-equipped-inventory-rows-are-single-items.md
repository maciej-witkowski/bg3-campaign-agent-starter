# ADR-0018: Equipped inventory rows represent one physical item

Status: Accepted

Milestone: M1 — Canonical Campaign Database

Refines: ADR-0013 relational inventory model and ADR-0014 campaign validation

## Context and problem statement

M1 stores inventory quantity on an inventory row and stores at most one equipment assignment for that row. The current validator requires only a positive quantity. It therefore accepts an `EQUIPPED` row with `quantity > 1`, one owner and one slot, which makes the canonical state claim that a stack of physical copies occupies a single equipment position.

The finding was reported by Codex review `5040869921` on commit `645762e`. Correcting it requires an explicit decision about whether equipping implicitly splits a stack, rejects the request or changes the inventory representation.

## Decision drivers and invariants

- Canonical state must describe how many physical copies are equipped without ambiguity.
- One equipment assignment identifies one inventory row and one character slot.
- Mutations must not silently invent identities, acquisition metadata or provenance for split rows.
- Invalid equipment changes roll back atomically and create no audit event.
- Existing non-equipped stacks remain valid and retain their positive quantity.
- M1 must not add later import, inventory-editing or user-interaction workflows.

## Considered options

### Option A — Reject equipped rows whose quantity is not exactly one

Add a campaign validation invariant `status === EQUIPPED => quantity === 1`. A caller must provide a single-item row before it can be equipped. M1 reports a typed validation failure and does not split or repair data.

### Option B — Split stacks automatically during equipment mutation

Create a new inventory row with quantity one, reduce the source stack and transfer placement metadata before assigning equipment. This needs an ID source, rules for acquisition metadata and notes, and a policy for which resulting row retains provenance. Silent splitting would introduce behavior not requested by M1.

### Option C — Remove quantity and represent every physical copy as a separate row

This removes stack ambiguity but requires a schema migration and destructive normalization of existing inventory rows.

### Option D — Keep positive quantity as the only invariant

This preserves the current implementation but allows an internally contradictory equipped stack and fails the campaign-state correctness requirement.

## Proposed decision and rationale

Select Option A.

An inventory row with status `EQUIPPED` must have `quantity === 1`. Rows in every other status keep the existing positive-integer quantity rule. `validateCampaignState()` will return a stable `EQUIPPED_QUANTITY_INVALID` violation for each equipped stack.

The validator rejects rather than repairs the request. The enclosing ADR-0014 transaction rolls back placement and assignment writes and creates no audit event. M1 will not expose automatic or generic stack splitting; a future typed inventory operation may split a stack only after separately deciding identity and provenance semantics.

## Boundaries and dependency direction

- The invariant belongs to domain validation, not UI, model or SQLite adapter orchestration.
- The transaction-scoped validation reader already supplies inventory rows; no new persistence capability is needed.
- Inventory and equipment mutation services continue through the mandatory ADR-0014 coordinator.
- Adapters may present the typed violation but may not bypass, repair or split the row directly.

## Data, migration and compatibility impact

- No schema or migration change is proposed in this remediation.
- Existing non-equipped rows with quantity greater than one remain valid.
- A pre-existing `EQUIPPED` row with quantity greater than one becomes an explicit validation conflict and must be reconciled before a later mutation can commit.
- The SQLite positive-quantity constraint remains unchanged. The new rule is a domain relationship between quantity, status and equipment assignment and is enforced on every typed write before commit.
- Migration hashes `0000` through `0002` remain unchanged.

Adding a SQLite check would rebuild a referenced table and requires a migration policy for already contradictory rows. That can be proposed later with explicit reconciliation behavior; M1 will not silently rewrite such data.

## Transaction, validation, audit and rollback impact

- Add `EQUIPPED_QUANTITY_INVALID` to the stable campaign validation codes.
- Validation runs after all requested equipment writes and before snapshot/audit acceptance.
- Attempting to equip a stacked row throws `CampaignValidationError`.
- The inventory status, owner, equipment assignment and audit event all roll back together.
- The original stack remains byte-for-byte unchanged after failure.

## Security, privacy and external-data impact

- No dependency, network access or external data source is added.
- Errors expose only the stable violation code and affected entity IDs, not private snapshots or SQL.
- No campaign data is guessed, duplicated or silently discarded.

## Required tests and operational evidence

- Validator unit test: `EQUIPPED` plus `quantity > 1` produces `EQUIPPED_QUANTITY_INVALID`.
- Transaction regression: equipping a non-equipped stack fails, restores its original status/owner/quantity, creates no equipment row and creates no audit event.
- Existing atomic equipment swap and single-item equipment tests remain green.
- The stale-DTO placement regression uses a canonical single-item row and still proves unrelated fields are preserved.
- Add a scenario regression documenting that a stacked item must be explicitly split before equipping.
- Full `pnpm check`, high-severity audit, migration-hash verification, CI/security and current-head Codex review pass.

## Consequences and trade-offs

- Canonical equipped state becomes unambiguous.
- Stacks remain compact while not equipped.
- M1 cannot directly equip one copy from a stacked row because it intentionally lacks a split operation.
- Callers receive an explicit conflict instead of a convenient but provenance-ambiguous automatic split.
- A future stack-splitting service can be added without changing the meaning of existing equipped rows.

## Rejected alternatives

- Automatic splitting is rejected because identity and provenance decisions must be explicit and audited.
- One-row-per-copy migration is rejected as destructive and unnecessary for M1.
- Keeping the status quo is rejected because it permits contradictory canonical state.
- Silently changing quantity to one is rejected because it would lose inventory data.

## Unresolved questions

None blocking for this decision. The identity, metadata and user-confirmation policy for a future stack-splitting operation remains outside M1 and requires its own design before implementation.

## Approval record

- Approved by the repository owner in the Codex task on 2026-08-27.
- Approval scope: the complete ADR-0018 proposal without requested changes.

## Change log

- 2026-08-27 — Proposed after Codex review `5040869921` identified that one equipment assignment could incorrectly represent a stacked inventory row.
- 2026-08-27 — Accepted after explicit repository-owner approval.
