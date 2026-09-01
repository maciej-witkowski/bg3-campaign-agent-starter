import { z } from "zod";

import { mutationConfirmationSchema, jsonObjectSchema } from "./domain-contracts.js";

const nonBlankStringSchema = z.string().min(1).regex(/\S/u);
const emptyInputSchema = z.object({}).strict();
const characterInputSchema = z.object({ character: nonBlankStringSchema }).strict();

const uniqueNonBlankStringsSchema = z
  .array(nonBlankStringSchema)
  .refine((values) => new Set(values).size === values.length);

export const inventoryStatusSchema = z.enum([
  "EQUIPPED",
  "CHEST",
  "SITUATIONAL",
  "PERSONAL_STORY",
  "SOLD",
  "UNKNOWN",
]);

export const ownedInventoryStatusSchema = z.enum(["CHEST", "SITUATIONAL", "PERSONAL_STORY"]);

export const attributeKeySchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);

export const spellSourceSchema = z.enum([
  "CLASS",
  "SPELLBOOK",
  "PACT",
  "DOMAIN",
  "ITEM",
  "INVOCATION",
  "RACE",
  "FEAT",
  "OTHER",
]);

export const getPartyInputSchema = emptyInputSchema;
export const getCharacterInputSchema = characterInputSchema;
export const getCharacterBuildInputSchema = characterInputSchema;
export const getCharacterEquipmentInputSchema = characterInputSchema;

export const findInventoryItemsInputSchema = z
  .object({
    status: z.array(inventoryStatusSchema).optional(),
    slot: z.string().optional(),
    query: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
  })
  .strict();

export const getItemInputSchema = z.object({ item: nonBlankStringSchema }).strict();

export const getCharacterSpellsInputSchema = z
  .object({
    character: nonBlankStringSchema,
    known: z.boolean().optional(),
    prepared: z.boolean().optional(),
    source: spellSourceSchema.optional(),
  })
  .strict();

export const getIllithidStateInputSchema = z
  .object({ character: nonBlankStringSchema.optional() })
  .strict();

export const getRecentChangesInputSchema = z
  .object({ limit: z.number().int().min(1).max(1_000).default(20) })
  .strict();

export const compareEquipmentInputSchema = z
  .object({
    character: nonBlankStringSchema,
    candidate_item: nonBlankStringSchema,
    slot: nonBlankStringSchema.optional(),
    include_party_synergies: z.boolean().default(true),
  })
  .strict();

export const calculateEffectiveAttributesInputSchema = characterInputSchema;

export const findEquipmentCandidatesInputSchema = z
  .object({
    character: nonBlankStringSchema,
    slot: nonBlankStringSchema,
    effect_types: uniqueNonBlankStringsSchema.min(1).optional(),
  })
  .strict();

export const validateCampaignStateInputSchema = emptyInputSchema;

export const resolveItemIdentityInputSchema = z
  .object({
    name_pl: nonBlankStringSchema,
    item_type_pl: nonBlankStringSchema.optional(),
    rarity_pl: nonBlankStringSchema.optional(),
    effect_text_pl: z.array(nonBlankStringSchema).optional(),
    allow_external_research: z.boolean().default(true),
  })
  .strict();

export const createProposalInputSchema = z
  .object({
    intent_type: nonBlankStringSchema,
    human_summary_pl: nonBlankStringSchema,
    payload: jsonObjectSchema,
    expires_in_seconds: z.number().int().min(30).max(86_400).optional(),
  })
  .strict();

export const addOwnedItemInputSchema = z
  .object({
    name_pl: nonBlankStringSchema,
    status: ownedInventoryStatusSchema,
    item_type_pl: nonBlankStringSchema.optional(),
    rarity_pl: nonBlankStringSchema.optional(),
    effect_text_pl: z.array(nonBlankStringSchema).optional(),
    obtained_location: nonBlankStringSchema.optional(),
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const equipItemInputSchema = z
  .object({
    character: nonBlankStringSchema,
    item: nonBlankStringSchema,
    slot: nonBlankStringSchema,
    old_item_destination: ownedInventoryStatusSchema,
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const moveItemToChestInputSchema = z
  .object({ item: nonBlankStringSchema, confirmation: mutationConfirmationSchema })
  .strict();

export const markItemSoldInputSchema = moveItemToChestInputSchema;

export const setPreparedSpellsInputSchema = z
  .object({
    character: nonBlankStringSchema,
    prepared_spells: uniqueNonBlankStringsSchema,
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const addCharacterAbilityInputSchema = z
  .object({
    character: nonBlankStringSchema,
    ability: nonBlankStringSchema,
    source: nonBlankStringSchema,
    level_acquired: z.number().int().min(1).max(12).optional(),
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const unlockIllithidPowerInputSchema = z
  .object({
    character: nonBlankStringSchema,
    power: nonBlankStringSchema,
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const applyPermanentModifierInputSchema = z
  .object({
    character: nonBlankStringSchema,
    attribute: attributeKeySchema,
    modifier: z.number().int(),
    source_name_pl: nonBlankStringSchema,
    notes: nonBlankStringSchema.optional(),
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const createCheckpointInputSchema = z
  .object({
    label: nonBlankStringSchema,
    reason_pl: nonBlankStringSchema,
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export const revertChangeInputSchema = z
  .object({
    change_event_id: nonBlankStringSchema,
    reason_pl: nonBlankStringSchema,
    confirmation: mutationConfirmationSchema,
  })
  .strict();

export type GetPartyInput = z.infer<typeof getPartyInputSchema>;
export type GetCharacterInput = z.infer<typeof getCharacterInputSchema>;
export type GetCharacterBuildInput = z.infer<typeof getCharacterBuildInputSchema>;
export type GetCharacterEquipmentInput = z.infer<typeof getCharacterEquipmentInputSchema>;
export type FindInventoryItemsInput = z.infer<typeof findInventoryItemsInputSchema>;
export type GetItemInput = z.infer<typeof getItemInputSchema>;
export type GetCharacterSpellsInput = z.infer<typeof getCharacterSpellsInputSchema>;
export type GetIllithidStateInput = z.infer<typeof getIllithidStateInputSchema>;
export type GetRecentChangesInput = z.infer<typeof getRecentChangesInputSchema>;
export type CompareEquipmentInput = z.infer<typeof compareEquipmentInputSchema>;
export type CalculateEffectiveAttributesInput = z.infer<
  typeof calculateEffectiveAttributesInputSchema
>;
export type FindEquipmentCandidatesInput = z.infer<typeof findEquipmentCandidatesInputSchema>;
export type ValidateCampaignStateInput = z.infer<typeof validateCampaignStateInputSchema>;
export type ResolveItemIdentityInput = z.infer<typeof resolveItemIdentityInputSchema>;
export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;
export type AddOwnedItemInput = z.infer<typeof addOwnedItemInputSchema>;
export type EquipItemInput = z.infer<typeof equipItemInputSchema>;
export type MoveItemToChestInput = z.infer<typeof moveItemToChestInputSchema>;
export type MarkItemSoldInput = z.infer<typeof markItemSoldInputSchema>;
export type SetPreparedSpellsInput = z.infer<typeof setPreparedSpellsInputSchema>;
export type AddCharacterAbilityInput = z.infer<typeof addCharacterAbilityInputSchema>;
export type UnlockIllithidPowerInput = z.infer<typeof unlockIllithidPowerInputSchema>;
export type ApplyPermanentModifierInput = z.infer<typeof applyPermanentModifierInputSchema>;
export type CreateCheckpointInput = z.infer<typeof createCheckpointInputSchema>;
export type RevertChangeInput = z.infer<typeof revertChangeInputSchema>;
