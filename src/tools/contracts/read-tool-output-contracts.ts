import { z } from "zod";

const nullableString = z.string().nullable();
const isoDate = z.iso.datetime({ offset: true });

export const characterIdentityOutputSchema = z
  .object({ id: z.string(), canonical_name: z.string(), display_name_pl: z.string() })
  .strict();

export const effectiveAttributeOutputSchema = z
  .object({
    attribute: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]),
    base_value: z.number().int(),
    effective_value: z.number().int(),
  })
  .strict();

const characterSummarySchema = characterIdentityOutputSchema
  .extend({
    race_pl: nullableString,
    class_pl: z.string(),
    subclass_pl: nullableString,
    level: z.number().int(),
    role_summary: z.string(),
    active_party: z.boolean(),
  })
  .strict();

const modifierSchema = z
  .object({
    id: z.string(),
    target_key: z.string(),
    modifier: z.number().int(),
    source_name_pl: z.string(),
    provenance_type: z.string(),
    permanent: z.boolean(),
    active: z.boolean(),
    notes: nullableString,
    created_at: isoDate,
  })
  .strict();

const abilitySchema = z
  .object({
    id: z.string(),
    name_pl: z.string(),
    name_en: nullableString,
    type: z.string(),
    description_pl: nullableString,
    verification_status: z.string(),
    source: z.string(),
    level_acquired: z.number().int().nullable(),
    notes: nullableString,
  })
  .strict();

const itemEffectSchema = z
  .object({
    id: z.string(),
    effect_type: z.string(),
    numeric_value: z.number().nullable(),
    dice_expression: nullableString,
    damage_type: nullableString,
    trigger: nullableString,
    condition_text_pl: nullableString,
    duration_text_pl: nullableString,
    description_pl: z.string(),
    verification_status: z.string(),
  })
  .strict();

const itemDefinitionSchema = z
  .object({
    id: z.string(),
    name_pl: z.string(),
    name_en: nullableString,
    type_pl: nullableString,
    slot: nullableString,
    rarity_pl: nullableString,
    description_pl: nullableString,
    verification_status: z.string(),
    verification_confidence: z.number().nullable(),
    verification_source: nullableString,
    notes: nullableString,
  })
  .strict();

const inventoryItemSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    owner_character_id: nullableString,
    quantity: z.number().int(),
    obtained_at: isoDate.nullable(),
    obtained_location: nullableString,
    notes: nullableString,
  })
  .strict();

const equipmentAssignmentSchema = z
  .object({
    inventory_item_id: z.string(),
    character_id: z.string(),
    slot: z.string(),
  })
  .strict();

export const inventoryItemOutputSchema = z
  .object({
    inventory_item: inventoryItemSchema,
    definition: itemDefinitionSchema,
    effects: z.array(itemEffectSchema),
    owner: characterIdentityOutputSchema.nullable(),
    equipment: equipmentAssignmentSchema.nullable(),
  })
  .strict();

export const getPartyOutputSchema = z
  .object({
    characters: z.array(
      characterIdentityOutputSchema
        .extend({
          class_pl: z.string(),
          subclass_pl: nullableString,
          level: z.number().int(),
          role_summary: z.string(),
          attributes: z.array(effectiveAttributeOutputSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const getCharacterOutputSchema = z
  .object({
    character: characterSummarySchema,
    attributes: z.array(effectiveAttributeOutputSchema),
    permanent_modifiers: z.array(modifierSchema),
  })
  .strict();

export const getCharacterBuildOutputSchema = getCharacterOutputSchema
  .extend({
    abilities: z.array(abilitySchema),
    spells: z.array(
      z
        .object({
          id: z.string(),
          name_pl: z.string(),
          name_en: nullableString,
          level: z.number().int(),
          school_pl: nullableString,
          description_pl: nullableString,
          verification_status: z.string(),
          source: z.string(),
          known: z.boolean(),
          prepared: z.boolean(),
          always_prepared: z.boolean(),
          notes: nullableString,
        })
        .strict(),
    ),
  })
  .strict();

export const getCharacterEquipmentOutputSchema = z
  .object({ character: characterIdentityOutputSchema, items: z.array(inventoryItemOutputSchema) })
  .strict();
export const findInventoryItemsOutputSchema = z
  .object({ items: z.array(inventoryItemOutputSchema) })
  .strict();
export const getItemOutputSchema = z
  .object({ definition: itemDefinitionSchema, instances: z.array(inventoryItemOutputSchema) })
  .strict();
export const getCharacterSpellsOutputSchema = z
  .object({
    character: characterIdentityOutputSchema,
    spells: getCharacterBuildOutputSchema.shape.spells,
  })
  .strict();

export const getIllithidStateOutputSchema = z
  .object({
    character: characterIdentityOutputSchema.nullable(),
    powers: z.array(
      z
        .object({
          id: z.string(),
          name_pl: z.string(),
          name_en: nullableString,
          tier: z.number().int().nullable(),
          description_pl: nullableString,
          verification_status: z.string(),
          prerequisite_power_ids: z.array(z.string()),
          acquired: z.boolean().nullable(),
          acquired_at: isoDate.nullable(),
          acquisition_source_pl: nullableString,
          notes: nullableString,
        })
        .strict(),
    ),
  })
  .strict();

export const getRecentChangesOutputSchema = z
  .object({
    limit: z.number().int(),
    changes: z.array(
      z
        .object({
          id: z.string(),
          occurred_at: isoDate,
          type: z.string(),
          character_id: nullableString,
          checkpoint_id: nullableString,
          proposal_id: nullableString,
          summary_pl: z.string(),
          reason_pl: nullableString,
          reverses_change_event_id: nullableString,
        })
        .strict(),
    ),
  })
  .strict();

export const compareEquipmentOutputSchema = z
  .object({
    character: characterIdentityOutputSchema,
    attributes: z.array(effectiveAttributeOutputSchema),
    candidate: inventoryItemOutputSchema,
    currently_equipped: z.array(inventoryItemOutputSchema),
    include_party_synergies: z.boolean(),
    party_equipment: z.array(
      z
        .object({
          character: characterIdentityOutputSchema,
          items: z.array(inventoryItemOutputSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const calculateEffectiveAttributesOutputSchema = z
  .object({
    character: characterIdentityOutputSchema,
    attributes: z.array(effectiveAttributeOutputSchema),
  })
  .strict();
export const findEquipmentCandidatesOutputSchema = z
  .object({
    character: characterIdentityOutputSchema,
    slot: z.string(),
    effect_types: z.array(z.string()),
    items: z.array(inventoryItemOutputSchema),
  })
  .strict();

export const validateCampaignStateOutputSchema = z
  .object({
    valid: z.boolean(),
    violations: z.array(
      z.object({ code: z.string(), message: z.string(), entity_ids: z.array(z.string()) }).strict(),
    ),
  })
  .strict();

export type InventoryItemOutput = z.infer<typeof inventoryItemOutputSchema>;
export type GetPartyOutput = z.infer<typeof getPartyOutputSchema>;
export type GetCharacterOutput = z.infer<typeof getCharacterOutputSchema>;
export type GetCharacterBuildOutput = z.infer<typeof getCharacterBuildOutputSchema>;
export type GetCharacterEquipmentOutput = z.infer<typeof getCharacterEquipmentOutputSchema>;
export type FindInventoryItemsOutput = z.infer<typeof findInventoryItemsOutputSchema>;
export type GetItemOutput = z.infer<typeof getItemOutputSchema>;
export type GetCharacterSpellsOutput = z.infer<typeof getCharacterSpellsOutputSchema>;
export type GetIllithidStateOutput = z.infer<typeof getIllithidStateOutputSchema>;
export type GetRecentChangesOutput = z.infer<typeof getRecentChangesOutputSchema>;
export type CompareEquipmentOutput = z.infer<typeof compareEquipmentOutputSchema>;
export type CalculateEffectiveAttributesOutput = z.infer<
  typeof calculateEffectiveAttributesOutputSchema
>;
export type FindEquipmentCandidatesOutput = z.infer<typeof findEquipmentCandidatesOutputSchema>;
export type ValidateCampaignStateOutput = z.infer<typeof validateCampaignStateOutputSchema>;
