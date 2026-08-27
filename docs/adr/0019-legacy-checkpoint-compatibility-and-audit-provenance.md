# ADR-0019: Legacy checkpoint compatibility and audit provenance

Status: Accepted

Milestone: M1 — Canonical Campaign Database

## Context and problem statement

ADR-0015 introduced deterministic versioned campaign snapshots and first-class SQLite checkpoints. Review of the unmerged M1 implementation exposed two compatibility and provenance gaps.

Migration `0002_wild_warpath` preserves pre-V1 checkpoint payload bytes but labels every legacy row as `BG3_CAMPAIGN_SNAPSHOT` version 1. Those opaque payloads do not necessarily satisfy the strict V1 envelope and can therefore be rejected as structurally invalid after being advertised as V1.

Checkpoint creation is audited atomically, but checkpoints are intentionally excluded from campaign-state snapshots. The current audit event therefore has identical before/after snapshots and no structured checkpoint identity. Human summary text supplied by a caller is insufficient for reliable association.

## Decision drivers and invariants

- Existing checkpoint payload and digest bytes must not be rewritten or silently reinterpreted.
- Unsupported legacy data must remain explicitly distinguishable from valid V1 snapshots.
- Previously published migration `0002` must not be rewritten.
- Every checkpoint-creation audit event must identify the checkpoint structurally.
- Checkpoint insertion and audit insertion must remain one transaction.
- SQLite remains the only writable source of truth.
- M1 still does not implement restore, undo or snapshot conversion.

## Proposed decision

### Forward-only legacy classification

Add a forward migration after `0002` that reclassifies rows backfilled by `0002` from `BG3_CAMPAIGN_SNAPSHOT` to `BG3_LEGACY_CHECKPOINT`.

The classification uses the existing historical marker `schema_version = 2`. Migration `0002` assigned that value to every legacy row, while checkpoints created by the V1 runtime use schema version 3 or later. The migration changes only `snapshot_format`; it preserves ID, label, timestamps, payload bytes, digest, version, reason and related event identity.

New checkpoint writes continue to use `BG3_CAMPAIGN_SNAPSHOT`. Checkpoint verification must inspect persisted format/version metadata before V1 deserialization and fail explicitly for `BG3_LEGACY_CHECKPOINT`. It must never attempt automatic conversion or restoration.

### Structured checkpoint audit provenance

Add nullable `checkpoint_id` to `change_events` as an indexed foreign key to `checkpoints.id` with restrictive deletion semantics. Existing audit events backfill to `NULL`.

Extend the internal mutation metadata and coordinator mapping with `checkpointId`. `CheckpointMutationService` supplies its generated checkpoint ID when executing the mutation. The coordinator inserts the audit event after the checkpoint row inside the same transaction, so the foreign key is valid and either both records commit or both roll back.

The checkpoint label and reason remain canonical on the checkpoint row. The audit event's structured foreign key provides reliable association without encoding identifiers into free-form summary text or misusing `proposal_id`.

## Data and migration impact

- Add one forward migration; do not edit migrations `0000`–`0002`.
- Reclassify only `snapshot_format` for historical rows identified by `schema_version = 2` and the currently incorrect V1 format.
- Add nullable indexed `change_events.checkpoint_id` with a foreign key to `checkpoints.id`.
- Update the Drizzle schema, domain model, read mappings and `docs/DATA_MODEL.md`.
- Advance the observed SQLite schema version used by newly captured snapshots.
- Preserve all existing campaign, audit and checkpoint rows.

## Transaction, validation and rollback impact

- Checkpoint creation order remains capture → checkpoint insert → campaign validation → audit snapshot → audit insert → commit.
- The audit foreign key is populated only for checkpoint creation.
- A checkpoint insert, validation, snapshot, foreign-key or audit failure rolls back both checkpoint and event.
- Read/verification operations remain zero-write.

## Required regression evidence

- Upgrade a database stopped at `0001`: the legacy checkpoint becomes `BG3_LEGACY_CHECKPOINT`, while payload, digest and all relations remain byte-for-byte unchanged.
- Upgrade a database already at `0002`: the compensating migration produces the same result.
- A valid V1 checkpoint with schema version 3 or later remains `BG3_CAMPAIGN_SNAPSHOT`.
- Fresh installation reaches the latest schema with foreign keys clean.
- Legacy verification fails with an explicit unsupported-format error before V1 deserialization.
- A newly created checkpoint audit event contains its exact `checkpoint_id` and resolves to the checkpoint carrying its label and reason.
- Existing non-checkpoint events retain `checkpoint_id = NULL`.
- Injected checkpoint and audit failures leave zero partial rows.
- Append-only audit protections remain effective with the new foreign key.

## Implementation evidence

- Generated migration `0003_natural_dazzler` adds nullable indexed
  `change_events.checkpoint_id` and forward-classifies only V1-labelled checkpoint
  rows carrying the historical `schema_version=2` marker.
- Migrations `0000`–`0002` remain byte-identical; payloads, digests and relations
  are not rewritten.
- Checkpoint mutation metadata carries the generated checkpoint ID internally, and
  the coordinator persists the foreign key in the same transaction after inserting
  the checkpoint.
- `verifyCheckpointSnapshot()` checks persisted format/version metadata before
  digest and V1 structure validation, returns explicit `UNSUPPORTED_FORMAT` for
  legacy rows, and rejects schema-version metadata that differs from the payload.
- The generated foreign key is materialized as explicit `ON DELETE RESTRICT`, and
  fresh-schema introspection verifies the column, index and physical action.
- Upgrade regressions cover databases stopped at both `0001` and `0002`, preserve
  valid schema-version-3 V1 rows, verify foreign keys, and exercise fresh schema,
  provenance, rollback and read-only paths.

## Rejected alternatives

- Rewriting `0002` is rejected because shared migrations are append-only history.
- Converting an opaque legacy payload into V1 is rejected because the historical campaign state cannot be reconstructed reliably from arbitrary JSON.
- Treating every legacy payload as V1 is rejected because it asserts compatibility that strict deserialization disproves.
- Embedding checkpoint identity only in `summary_pl` or `reason_pl` is rejected because free-form text is not a typed, queryable association.
- Reusing `proposal_id` is rejected because checkpoint identity is not proposal identity.

## Scope boundary

This ADR corrects M1 checkpoint compatibility and audit provenance only. It does not add restore, undo, backup rotation, payload conversion, checkpoint deletion or M2 behavior.

## Approval record

- Preparation authorized by the repository owner in the Codex task on 2026-08-27.
- Accepted by the repository owner in the Codex task on 2026-08-27.
- Approval scope: the complete ADR-0019 proposal without requested changes.

## Change log

- 2026-08-27 — Initial proposal after Codex review `5045547966` of commit `3c4ccaa`.
- 2026-08-27 — Accepted after explicit repository-owner approval.
- 2026-08-27 — Implemented forward migration, typed audit provenance and explicit
  legacy verification with upgrade/fresh-install regression evidence.