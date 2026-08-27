import type {
  Ability,
  ChangeEvent,
  Character,
  CharacterAbility,
  CharacterAttribute,
  CharacterIllithidPower,
  CharacterSpell,
  Checkpoint,
  EquipmentAssignment,
  IllithidPower,
  IllithidPowerPrerequisite,
  InventoryItem,
  ItemDefinition,
  ItemEffect,
  PermanentModifier,
  Spell,
} from "../model/campaign.js";

export interface CampaignStateReadRepository {
  findCharacter(id: string): Character | null;
  listCharacterAttributes(characterId: string): readonly CharacterAttribute[];
  listPermanentModifiers(characterId: string): readonly PermanentModifier[];
  findItemDefinition(id: string): ItemDefinition | null;
  listItemEffects(itemDefinitionId: string): readonly ItemEffect[];
  findInventoryItem(id: string): InventoryItem | null;
  listEquipment(characterId: string): readonly EquipmentAssignment[];
  findSpell(id: string): Spell | null;
  listCharacterSpells(characterId: string): readonly CharacterSpell[];
  findAbility(id: string): Ability | null;
  listCharacterAbilities(characterId: string): readonly CharacterAbility[];
  findIllithidPower(id: string): IllithidPower | null;
  listIllithidPrerequisites(powerId: string): readonly IllithidPowerPrerequisite[];
  listCharacterIllithidPowers(characterId: string): readonly CharacterIllithidPower[];
  findChangeEvent(id: string): ChangeEvent | null;
  findCheckpoint(id: string): Checkpoint | null;
}
