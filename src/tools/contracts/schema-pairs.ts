import type { ZodType } from "zod";

import {
  campaignIntentSchema,
  itemResolutionResultSchema,
  mutationConfirmationSchema,
  proposalSchema,
  toolResultSchema,
} from "./domain-contracts.js";
import {
  addCharacterAbilityInputSchema,
  addOwnedItemInputSchema,
  applyPermanentModifierInputSchema,
  calculateEffectiveAttributesInputSchema,
  compareEquipmentInputSchema,
  createCheckpointInputSchema,
  createProposalInputSchema,
  equipItemInputSchema,
  findEquipmentCandidatesInputSchema,
  findInventoryItemsInputSchema,
  getCharacterBuildInputSchema,
  getCharacterEquipmentInputSchema,
  getCharacterInputSchema,
  getCharacterSpellsInputSchema,
  getIllithidStateInputSchema,
  getItemInputSchema,
  getPartyInputSchema,
  getRecentChangesInputSchema,
  markItemSoldInputSchema,
  moveItemToChestInputSchema,
  resolveItemIdentityInputSchema,
  revertChangeInputSchema,
  setPreparedSpellsInputSchema,
  unlockIllithidPowerInputSchema,
  validateCampaignStateInputSchema,
} from "./tool-input-contracts.js";

export interface ContractSchemaPair {
  readonly jsonSchemaPath: `schemas/${string}.schema.json`;
  readonly zodSchema: ZodType;
}

export const CONTRACT_SCHEMA_PAIRS = [
  {
    jsonSchemaPath: "schemas/domain/confirmation.schema.json",
    zodSchema: mutationConfirmationSchema,
  },
  { jsonSchemaPath: "schemas/domain/intent.schema.json", zodSchema: campaignIntentSchema },
  {
    jsonSchemaPath: "schemas/domain/item-resolution-result.schema.json",
    zodSchema: itemResolutionResultSchema,
  },
  { jsonSchemaPath: "schemas/domain/proposal.schema.json", zodSchema: proposalSchema },
  { jsonSchemaPath: "schemas/domain/tool-result.schema.json", zodSchema: toolResultSchema },
  {
    jsonSchemaPath: "schemas/tools/add-character-ability.schema.json",
    zodSchema: addCharacterAbilityInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/add-owned-item.schema.json",
    zodSchema: addOwnedItemInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/apply-permanent-modifier.schema.json",
    zodSchema: applyPermanentModifierInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/calculate-effective-attributes.schema.json",
    zodSchema: calculateEffectiveAttributesInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/compare-equipment.schema.json",
    zodSchema: compareEquipmentInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/create-checkpoint.schema.json",
    zodSchema: createCheckpointInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/create-proposal.schema.json",
    zodSchema: createProposalInputSchema,
  },
  { jsonSchemaPath: "schemas/tools/equip-item.schema.json", zodSchema: equipItemInputSchema },
  {
    jsonSchemaPath: "schemas/tools/find-equipment-candidates.schema.json",
    zodSchema: findEquipmentCandidatesInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/find-inventory-items.schema.json",
    zodSchema: findInventoryItemsInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/get-character-build.schema.json",
    zodSchema: getCharacterBuildInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/get-character-equipment.schema.json",
    zodSchema: getCharacterEquipmentInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/get-character-spells.schema.json",
    zodSchema: getCharacterSpellsInputSchema,
  },
  { jsonSchemaPath: "schemas/tools/get-character.schema.json", zodSchema: getCharacterInputSchema },
  {
    jsonSchemaPath: "schemas/tools/get-illithid-state.schema.json",
    zodSchema: getIllithidStateInputSchema,
  },
  { jsonSchemaPath: "schemas/tools/get-item.schema.json", zodSchema: getItemInputSchema },
  { jsonSchemaPath: "schemas/tools/get-party.schema.json", zodSchema: getPartyInputSchema },
  {
    jsonSchemaPath: "schemas/tools/get-recent-changes.schema.json",
    zodSchema: getRecentChangesInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/mark-item-sold.schema.json",
    zodSchema: markItemSoldInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/move-item-to-chest.schema.json",
    zodSchema: moveItemToChestInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/resolve-item-identity.schema.json",
    zodSchema: resolveItemIdentityInputSchema,
  },
  { jsonSchemaPath: "schemas/tools/revert-change.schema.json", zodSchema: revertChangeInputSchema },
  {
    jsonSchemaPath: "schemas/tools/set-prepared-spells.schema.json",
    zodSchema: setPreparedSpellsInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/unlock-illithid-power.schema.json",
    zodSchema: unlockIllithidPowerInputSchema,
  },
  {
    jsonSchemaPath: "schemas/tools/validate-campaign-state.schema.json",
    zodSchema: validateCampaignStateInputSchema,
  },
] as const satisfies readonly ContractSchemaPair[];
