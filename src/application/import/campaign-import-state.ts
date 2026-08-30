import type {
  Ability,
  Character,
  CharacterAbility,
  CharacterAttribute,
  CharacterIllithidPower,
  CharacterSpell,
  EquipmentAssignment,
  IllithidPower,
  IllithidPowerPrerequisite,
  InventoryItem,
  ItemDefinition,
  ItemEffect,
  PermanentModifier,
  Spell,
} from "../../domain/model/campaign.js";

export interface CampaignImportState {
  readonly characters: readonly Character[];
  readonly characterAttributes: readonly CharacterAttribute[];
  readonly permanentModifiers: readonly PermanentModifier[];
  readonly itemDefinitions: readonly ItemDefinition[];
  readonly itemEffects: readonly ItemEffect[];
  readonly inventoryItems: readonly InventoryItem[];
  readonly equipment: readonly EquipmentAssignment[];
  readonly spells: readonly Spell[];
  readonly characterSpells: readonly CharacterSpell[];
  readonly abilities: readonly Ability[];
  readonly characterAbilities: readonly CharacterAbility[];
  readonly illithidPowers: readonly IllithidPower[];
  readonly illithidPowerPrerequisites: readonly IllithidPowerPrerequisite[];
  readonly characterIllithidPowers: readonly CharacterIllithidPower[];
}

export interface CampaignImportStateReadPort {
  readImportState(): CampaignImportState;
}
