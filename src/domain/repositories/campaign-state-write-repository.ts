import type {
  Ability,
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
  InventoryPlacement,
  ItemDefinition,
  ItemEffect,
  PermanentModifier,
  Spell,
} from "../model/campaign.js";

/** Internal capability: instances exist only inside CampaignMutationCoordinator callbacks. */
export interface CampaignStateWriteRepository {
  insertCheckpoint(value: Checkpoint): void;
  insertCharacter(value: Character): void;
  setCharacterAttribute(value: CharacterAttribute): boolean;
  insertPermanentModifier(value: PermanentModifier): void;
  insertItemDefinition(value: ItemDefinition): void;
  insertItemEffect(value: ItemEffect): void;
  insertInventoryItem(value: InventoryItem): void;
  findInventoryPlacement(id: string): InventoryPlacement | null;
  findEquipmentAssignment(inventoryItemId: string): EquipmentAssignment | null;
  findEquipmentAssignmentAtSlot(
    characterId: string,
    slot: EquipmentAssignment["slot"],
  ): EquipmentAssignment | null;
  setInventoryPlacement(value: InventoryPlacement): boolean;
  setEquipment(value: EquipmentAssignment): boolean;
  removeEquipment(inventoryItemId: string): boolean;
  insertSpell(value: Spell): void;
  setCharacterSpell(value: CharacterSpell): boolean;
  insertAbility(value: Ability): void;
  setCharacterAbility(value: CharacterAbility): boolean;
  insertIllithidPower(value: IllithidPower): void;
  setIllithidPrerequisite(value: IllithidPowerPrerequisite): boolean;
  setCharacterIllithidPower(value: CharacterIllithidPower): boolean;
}
