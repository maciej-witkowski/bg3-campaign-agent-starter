export const ATTRIBUTE_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export const PROVENANCE_TYPES = ["GAME_UI", "IMPORT", "USER_CONFIRMED", "SYSTEM"] as const;
export type ProvenanceType = (typeof PROVENANCE_TYPES)[number];

export const VERIFICATION_STATUSES = ["UNKNOWN", "UNVERIFIED", "VERIFIED", "CONFLICT"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ITEM_SLOTS = [
  "HEAD",
  "CLOAK",
  "BODY",
  "HANDS",
  "FEET",
  "NECK",
  "RING",
  "MAIN_HAND",
  "OFF_HAND",
  "RANGED",
  "INSTRUMENT",
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const EQUIPMENT_SLOTS = [
  "HEAD",
  "CLOAK",
  "BODY",
  "HANDS",
  "FEET",
  "NECK",
  "RING_1",
  "RING_2",
  "MAIN_HAND",
  "OFF_HAND",
  "RANGED_MAIN_HAND",
  "RANGED_OFF_HAND",
  "INSTRUMENT",
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const INVENTORY_STATUSES = [
  "EQUIPPED",
  "CHEST",
  "SITUATIONAL",
  "PERSONAL_STORY",
  "SOLD",
  "UNKNOWN",
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const SPELL_SOURCES = [
  "CLASS",
  "SPELLBOOK",
  "PACT",
  "DOMAIN",
  "ITEM",
  "INVOCATION",
  "RACE",
  "FEAT",
  "OTHER",
] as const;
export type SpellSource = (typeof SPELL_SOURCES)[number];

export const ABILITY_TYPES = [
  "CANTRIP",
  "FEAT",
  "INVOCATION",
  "MANEUVER",
  "CLASS_FEATURE",
  "PACT",
  "PASSIVE",
] as const;
export type AbilityType = (typeof ABILITY_TYPES)[number];

export interface Character {
  readonly id: string;
  readonly canonicalName: string;
  readonly displayNamePl: string;
  readonly racePl: string | null;
  readonly classPl: string;
  readonly subclassPl: string | null;
  readonly level: number;
  readonly roleSummary: string;
  readonly activeParty: boolean;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface CharacterAttribute {
  readonly characterId: string;
  readonly attribute: AttributeKey;
  readonly baseValue: number;
}
export interface PermanentModifier {
  readonly id: string;
  readonly characterId: string;
  readonly targetType: "ATTRIBUTE";
  readonly targetKey: AttributeKey;
  readonly modifier: number;
  readonly sourceNamePl: string;
  readonly sourceItemDefinitionId: string | null;
  readonly provenanceType: ProvenanceType;
  readonly permanent: boolean;
  readonly active: boolean;
  readonly notes: string | null;
  readonly createdAt: Date;
}
export interface ItemDefinition {
  readonly id: string;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: string | null;
  readonly typePl: string | null;
  readonly slot: ItemSlot | null;
  readonly rarityPl: string | null;
  readonly descriptionPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly verificationConfidence: number | null;
  readonly verificationSource: string | null;
  readonly fingerprint: string | null;
  readonly notes: string | null;
}
export interface ItemEffect {
  readonly id: string;
  readonly itemDefinitionId: string;
  readonly effectType: string;
  readonly numericValue: number | null;
  readonly diceExpression: string | null;
  readonly damageType: string | null;
  readonly trigger: string | null;
  readonly conditionTextPl: string | null;
  readonly durationTextPl: string | null;
  readonly descriptionPl: string;
  readonly verificationStatus: VerificationStatus;
}
export interface InventoryItem {
  readonly id: string;
  readonly itemDefinitionId: string;
  readonly status: InventoryStatus;
  readonly ownerCharacterId: string | null;
  readonly quantity: number;
  readonly obtainedAt: Date | null;
  readonly obtainedLocation: string | null;
  readonly notes: string | null;
}
export interface InventoryPlacement {
  readonly id: string;
  readonly status: InventoryStatus;
  readonly ownerCharacterId: string | null;
}
export interface EquipmentAssignment {
  readonly inventoryItemId: string;
  readonly characterId: string;
  readonly slot: EquipmentSlot;
}
export interface Spell {
  readonly id: string;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: string | null;
  readonly level: number;
  readonly schoolPl: string | null;
  readonly descriptionPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly notes: string | null;
}
export interface CharacterSpell {
  readonly characterId: string;
  readonly spellId: string;
  readonly source: SpellSource;
  readonly known: boolean;
  readonly prepared: boolean;
  readonly alwaysPrepared: boolean;
  readonly notes: string | null;
}
export interface Ability {
  readonly id: string;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: string | null;
  readonly type: AbilityType;
  readonly descriptionPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly notes: string | null;
}
export interface CharacterAbility {
  readonly characterId: string;
  readonly abilityId: string;
  readonly source: string;
  readonly levelAcquired: number | null;
  readonly notes: string | null;
}
export interface IllithidPower {
  readonly id: string;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: string | null;
  readonly tier: number | null;
  readonly descriptionPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly notes: string | null;
}
export interface IllithidPowerPrerequisite {
  readonly powerId: string;
  readonly prerequisitePowerId: string;
}
export interface CharacterIllithidPower {
  readonly characterId: string;
  readonly powerId: string;
  readonly acquiredAt: Date | null;
  readonly acquisitionSourcePl: string | null;
  readonly notes: string | null;
}
export interface ChangeEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly type: string;
  readonly characterId: string | null;
  readonly proposalId: string | null;
  readonly summaryPl: string;
  readonly reasonPl: string | null;
  readonly beforeJson: string;
  readonly afterJson: string;
  readonly reversesChangeEventId: string | null;
}
export interface Checkpoint {
  readonly id: string;
  readonly label: string;
  readonly createdAt: Date;
  readonly snapshotFormat: string;
  readonly snapshotVersion: number;
  readonly schemaVersion: number;
  readonly snapshotJson: string;
  readonly snapshotSha256: string;
  readonly reasonPl: string;
  readonly changeEventId: string | null;
}
