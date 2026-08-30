# Codex Task — M15 — Campaign Initialization and Onboarding

## Required reading

Read completely before changing code:

- `AGENTS.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DOMAIN_RULES.md`
- `docs/TOOLS.md`
- `docs/DECISION_PROTOCOL.md`
- `docs/ITEM_RESOLUTION.md`
- `docs/SECURITY.md`
- `docs/OPERATIONS.md`
- `docs/TESTING.md`
- `docs/IMPORT_EXPORT.md`
- applicable ADRs

Follow `docs/MILESTONE_DELIVERY_WORKFLOW.md` end to end. Create detailed proposed
M15 ADRs and obtain explicit user approval before implementation.

## Goal

Implement one guided onboarding contract for two entry modes:

1. `NEW_CAMPAIGN` — initialize a valid campaign from an empty latest-schema database,
   with a minimal party and empty optional collections allowed;
2. `EXISTING_CAMPAIGN` — capture current mid-campaign state in reviewable batches,
   including characters, current statistics, permanent modifiers, equipment, travel
   chest, spells, abilities and illithid powers.

The clean-start mode is the recommended default. Existing-campaign onboarding is a
bounded adoption path, not a general migration framework.

## Required behavior

- Reuse M1 validation/audit boundaries, M2 staging/report concepts, M6 confirmed
  mutations and M7 identity resolution where applicable.
- Provide the same application contract to CLI and desktop adapters.
- Preview inserted, matched, skipped, ambiguous and conflicting facts before writes.
- Apply only explicit accepted batches through typed transactional services.
- Make interruption/retry safe and repeated accepted input duplicate-resistant.
- Preserve exact Polish names, unknown optional facts and source provenance.
- Create a completion summary and initial checkpoint after successful onboarding.
- Refuse a different non-empty target campaign.
- Never fabricate prior gameplay chronology or audit events.

## Explicit non-goals

- arbitrary SQL or UI-to-database writes;
- general-purpose spreadsheet mapping;
- automatic save-file or process-memory parsing;
- silent identity resolution or inferred missing facts;
- replacing/merging an unrelated non-empty campaign;
- cloud sync, multi-user or multi-campaign management;
- backup rotation and restore operations from M16.

## Required evidence

- fresh-campaign scenario with a minimal valid party and empty inventory/capabilities;
- sanitized mid-campaign scenario entered across multiple batches;
- equivalent CLI and desktop canonical results;
- idempotent retry without duplicate facts or audit mutations;
- ambiguity, slot conflict, invalid derived statistics, interruption and stale-input
  failure paths with zero partial writes;
- privacy check proving drafts/reports/databases remain excluded from Git by default;
- full repository quality gate and milestone-specific scenario tests.

## Required final report

Return:

1. files changed/created;
2. architecture decisions and ADR approval evidence;
3. commands/tests run and results;
4. migrations and campaign-state impact;
5. onboarding behavior for both entry modes;
6. unresolved risks/questions and suggested review points;
7. explicit confirmation that M16 was not started.
