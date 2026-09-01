import type {
  Ability,
  AttributeKey,
  Character,
  CharacterAbility,
  CharacterAttribute,
  CharacterIllithidPower,
  CharacterSpell,
  EquipmentAssignment,
  IllithidPower,
  IllithidPowerPrerequisite,
  InventoryItem,
  InventoryStatus,
  ItemDefinition,
  ItemEffect,
  ItemSlot,
  PermanentModifier,
  Spell,
} from "../../domain/model/campaign.js";

export interface CharacterIdentityView {
  readonly id: string;
  readonly canonicalName: string;
  readonly displayNamePl: string;
}

export interface EffectiveAttributeView {
  readonly attribute: AttributeKey;
  readonly baseValue: number;
  readonly effectiveValue: number;
}

export interface PartyCharacterView extends CharacterIdentityView {
  readonly classPl: string;
  readonly subclassPl: string | null;
  readonly level: number;
  readonly roleSummary: string;
  readonly attributes: readonly EffectiveAttributeView[];
}

export interface PartyView {
  readonly characters: readonly PartyCharacterView[];
}

export interface CharacterAbilityView {
  readonly assignment: CharacterAbility;
  readonly definition: Ability;
}

export interface CharacterView {
  readonly character: Character;
  readonly attributes: readonly EffectiveAttributeView[];
  readonly permanentModifiers: readonly PermanentModifier[];
  readonly abilities: readonly CharacterAbilityView[];
}

export interface EquipmentItemView {
  readonly assignment: EquipmentAssignment;
  readonly inventoryItem: InventoryItem;
  readonly definition: ItemDefinition;
  readonly effects: readonly ItemEffect[];
}

export interface EquipmentView {
  readonly character: CharacterIdentityView;
  readonly items: readonly EquipmentItemView[];
}

export interface InventoryFilters {
  readonly slots?: readonly ItemSlot[];
  readonly statuses?: readonly InventoryStatus[];
  readonly tags?: readonly string[];
}

export interface InventoryItemView {
  readonly inventoryItem: InventoryItem;
  readonly definition: ItemDefinition;
  readonly effects: readonly ItemEffect[];
  readonly owner: CharacterIdentityView | null;
  readonly equipment: EquipmentAssignment | null;
}

export interface InventoryView {
  readonly filters: Required<InventoryFilters>;
  readonly items: readonly InventoryItemView[];
}

export interface CharacterSpellView {
  readonly assignment: CharacterSpell;
  readonly definition: Spell;
}

export interface SpellsView {
  readonly character: CharacterIdentityView;
  readonly spells: readonly CharacterSpellView[];
}

export interface IllithidPowerView {
  readonly definition: IllithidPower;
  readonly prerequisitePowerIds: readonly string[];
  readonly acquisition: CharacterIllithidPower | null;
}

export interface IllithidView {
  readonly character: CharacterIdentityView | null;
  readonly powers: readonly IllithidPowerView[];
}

export interface ChangeSummaryView {
  readonly id: string;
  readonly occurredAt: Date;
  readonly type: string;
  readonly characterId: string | null;
  readonly checkpointId: string | null;
  readonly proposalId: string | null;
  readonly summaryPl: string;
  readonly reasonPl: string | null;
  readonly reversesChangeEventId: string | null;
}

export interface ChangesView {
  readonly limit: number;
  readonly changes: readonly ChangeSummaryView[];
}

export interface CampaignInspectionReadSession {
  listCharacters(): readonly Character[];
  listCharacterAttributes(characterId: string): readonly CharacterAttribute[];
  listPermanentModifiers(characterId: string): readonly PermanentModifier[];
  listAbilities(): readonly Ability[];
  listCharacterAbilities(characterId: string): readonly CharacterAbility[];
  listItemDefinitions(): readonly ItemDefinition[];
  listItemEffects(): readonly ItemEffect[];
  listInventoryItems(): readonly InventoryItem[];
  listEquipment(characterId?: string): readonly EquipmentAssignment[];
  listSpells(): readonly Spell[];
  listCharacterSpells(characterId: string): readonly CharacterSpell[];
  listIllithidPowers(): readonly IllithidPower[];
  listIllithidPrerequisites(): readonly IllithidPowerPrerequisite[];
  listCharacterIllithidPowers(characterId: string): readonly CharacterIllithidPower[];
  listRecentChanges(limit: number): readonly ChangeSummaryView[];
}

export interface CampaignInspectionReadPort {
  read<T>(operation: (session: CampaignInspectionReadSession) => T): T;
}

export const DEFAULT_CHANGE_LIMIT = 20;
export const MAX_CHANGE_LIMIT = 1_000;

export type CampaignInspectionErrorCode =
  | "CHARACTER_NOT_FOUND"
  | "CHARACTER_AMBIGUOUS"
  | "INVALID_FILTER"
  | "INVALID_LIMIT"
  | "INCONSISTENT_STATE";

export class CampaignInspectionError extends Error {
  public override readonly name = "CampaignInspectionError";

  public constructor(
    public readonly code: CampaignInspectionErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}
