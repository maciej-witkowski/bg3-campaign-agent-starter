# Tool Contracts

Tools are stable application contracts. The OpenAI layer may expose them as custom function calls, but they must also be callable in tests without a model.

## Implemented M4 contract boundary

- JSON Schema files are the normative serialized contracts; strict Zod mirrors perform
  non-coercing runtime validation.
- The active M4 registry contains only the nine read and four deterministic analysis
  tools listed below. It has no mutation lookup.
- Every call returns a validated result envelope and uses bounded, safe errors.
- Dates are serialized as UTC ISO strings and transport DTO fields use snake_case.
- Research, resolver and temporary-workflow manifest entries remain unavailable until
  their roadmap milestones.
- Proposal and mutation registries are separate injectable contract APIs and are not
  wired into `openM4CampaignApplication()`.

## Result envelope

Every tool returns one of:

```json
{"ok":true,"data":{},"warnings":[]}
```

or

```json
{"ok":false,"error":{"code":"...","message_pl":"...","details":{}},"warnings":[]}
```

## Read tools

### get_party
Returns active characters and compact roles.

### get_character
Input: character identifier/name.
Returns canonical profile and effective attributes.

### get_character_build
Returns class/subclass, attributes/modifiers, feats/features, relevant spells and role.

### get_character_equipment
Returns one row per slot with verified effect summaries.

### find_inventory_items
Filters status, slot, owner, Polish name text and exact stored effect facets.

### get_item
Returns the conservatively resolved definition, effects, verification and owned
instances. Aliases remain M7 scope.

### get_character_spells
Supports known/prepared/source filters.

### get_illithid_state
Returns definitions, recorded acquisitions and known prerequisite IDs. M4 does not
infer availability or blocked state from incomplete data. Without a character scope,
`acquired` is `null`; only a character-scoped query may return `true` or `false`.

### get_recent_changes
Returns audit events.

## Analysis tools

### compare_equipment
Deterministic data assembly: current versus candidate, effective stats, tags, conditions. It should not make the final LLM recommendation itself.

### calculate_effective_attributes
Pure deterministic function.

### find_equipment_candidates
Returns compatible non-sold inventory based only on the requested slot and exact stored
effect types. It performs no M14 ranking, role scoring or inferred tagging.

### validate_campaign_state
Returns invariant violations without mutating.

## Research tools

### resolve_item_identity
Runs local resolver and optionally requests research.

### verify_item_effects
Returns external claims with citations/source metadata and conflict status.

## Mutation tools

Mutation input contracts require either:

- `confirmation.proposal_id`, or
- `confirmation.direct_fact=true` plus a request classified as explicit factual update.

These provider-visible fields do not authorize a write by themselves. Contract-only M4
mutation invocation additionally requires an out-of-band trusted context. The
authorization port binds that context to the exact tool, full validated payload and
confirmation mode. The production M4 application supplies no authorizer or concrete
mutation handlers; the operations below become real campaign workflows in M6.

### add_owned_item
Creates owned item after purchase/loot.

### equip_item
Atomically moves old equipped item to intended destination and equips candidate.

### move_item_to_chest

### mark_item_sold

### set_prepared_spells
Transactional replace/set operation with validation.

### add_character_ability

### unlock_illithid_power

### apply_permanent_modifier
Requires source/provenance.

### create_checkpoint

### revert_change
Creates a new reversal event; never deletes audit history.
