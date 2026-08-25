# Tool Contracts

Tools are stable application contracts. The OpenAI layer may expose them as custom function calls, but they must also be callable in tests without a model.

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
Filters status, slot, type, tags and text.

### get_item
Returns definition, effects, aliases, verification and owned instances.

### get_character_spells
Supports known/prepared/source filters.

### get_illithid_state
Returns unlocked, available and blocked nodes when prerequisites are known.

### get_recent_changes
Returns audit events.

## Analysis tools

### compare_equipment
Deterministic data assembly: current versus candidate, effective stats, tags, conditions. It should not make the final LLM recommendation itself.

### calculate_effective_attributes
Pure deterministic function.

### find_equipment_candidates
Returns likely candidate inventory based on slot/role/tags.

### validate_campaign_state
Returns invariant violations without mutating.

## Research tools

### resolve_item_identity
Runs local resolver and optionally requests research.

### verify_item_effects
Returns external claims with citations/source metadata and conflict status.

## Mutation tools

Mutation tools require either:

- `confirmation.proposal_id`, or
- `confirmation.direct_fact=true` plus a request classified as explicit factual update.

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
