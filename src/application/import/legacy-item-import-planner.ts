import type {
  EquipmentAssignment,
  InventoryItem,
  ItemDefinition,
  ItemEffect,
} from "../../domain/model/campaign.js";
import type { IdSource } from "../../domain/mutations/campaign-mutation.js";
import type { CampaignImportState } from "./campaign-import-state.js";
import type { ImportReportEntry } from "./import-contracts.js";
import type { NormalizedLegacyCampaign } from "./legacy-campaign-normalizer.js";
import type { LegacyCharacterImportPlan } from "./legacy-character-import-planner.js";
import type { NormalizedLegacyItem } from "./legacy-item-normalizer.js";

export interface PlannedItemDefinitionInsert {
  readonly id: string;
  readonly fact: NormalizedLegacyItem;
}
export interface PlannedItemEffectInsert {
  readonly id: string;
  readonly itemDefinitionId: string;
  readonly fact: NonNullable<NormalizedLegacyItem["effect"]>;
}
export interface PlannedInventoryItemInsert {
  readonly id: string;
  readonly itemDefinitionId: string;
  readonly ownerCharacterId: string | null;
  readonly fact: NormalizedLegacyItem;
}
export interface LegacyItemImportPlan {
  readonly itemDefinitions: readonly PlannedItemDefinitionInsert[];
  readonly itemEffects: readonly PlannedItemEffectInsert[];
  readonly inventoryItems: readonly PlannedInventoryItemInsert[];
  readonly equipment: readonly EquipmentAssignment[];
  readonly entries: readonly ImportReportEntry[];
  readonly blocked: boolean;
}

export function planLegacyItemImport(
  campaign: NormalizedLegacyCampaign,
  state: CampaignImportState,
  characters: LegacyCharacterImportPlan,
  ids: IdSource,
): LegacyItemImportPlan {
  const definitions: PlannedItemDefinitionInsert[] = [];
  const effects: PlannedItemEffectInsert[] = [];
  const inventory: PlannedInventoryItemInsert[] = [];
  const equipment: EquipmentAssignment[] = [];
  const entries: ImportReportEntry[] = [];

  for (const fact of campaign.items) {
    const fingerprintMatches = state.itemDefinitions.filter(
      (value) => value.fingerprint === fact.fingerprint,
    );
    const nameMatches = state.itemDefinitions.filter(
      (value) => value.normalizedNamePl === fact.normalizedNamePl,
    );
    let definitionId: string;
    let definitionIsNew = false;
    if (fingerprintMatches.length === 1) {
      const existing = fingerprintMatches[0]!;
      definitionId = existing.id;
      if (!definitionEquals(existing, fact)) {
        entries.push(
          report(
            fact,
            "item_definition",
            "conflicts",
            "ITEM_DEFINITION_FACT_CONFLICT",
            definitionId,
            true,
          ),
        );
        continue;
      }
      entries.push(
        report(fact, "item_definition", "matched", "ITEM_DEFINITION_EXACT_MATCH", definitionId),
      );
    } else if (fingerprintMatches.length > 1 || nameMatches.length > 0) {
      entries.push({
        ...report(fact, "item_definition", "ambiguous", "ITEM_DEFINITION_AMBIGUOUS", null),
        relatedIds: [
          ...new Set([...fingerprintMatches, ...nameMatches].map((value) => value.id)),
        ].sort(),
      });
      continue;
    } else {
      definitionId = ids.nextId();
      definitionIsNew = true;
      definitions.push({ id: definitionId, fact });
      entries.push(
        report(fact, "item_definition", "inserted", "ITEM_DEFINITION_INSERT_PLANNED", definitionId),
      );
    }

    if (fact.effect !== null) {
      const exactEffects = state.itemEffects.filter(
        (value) => value.itemDefinitionId === definitionId && effectEquals(value, fact.effect!),
      );
      const competingEffects = state.itemEffects.filter(
        (value) => value.itemDefinitionId === definitionId,
      );
      if (exactEffects.length === 1) {
        entries.push(
          report(fact, "item_effect", "matched", "ITEM_EFFECT_EXACT_MATCH", exactEffects[0]!.id),
        );
      } else if (exactEffects.length > 1 || (!definitionIsNew && competingEffects.length > 0)) {
        entries.push(
          report(fact, "item_effect", "conflicts", "ITEM_EFFECT_FACT_CONFLICT", definitionId, true),
        );
        continue;
      } else {
        const effectId = ids.nextId();
        effects.push({ id: effectId, itemDefinitionId: definitionId, fact: fact.effect });
        entries.push(
          report(fact, "item_effect", "inserted", "ITEM_EFFECT_INSERT_PLANNED", effectId),
        );
      }
    }

    const ownerCharacterId =
      fact.placement.ownerCharacterCanonicalName === null
        ? null
        : (characters.characterIdsByCanonicalName.get(fact.placement.ownerCharacterCanonicalName) ??
          null);
    if (fact.placement.ownerCharacterCanonicalName !== null && ownerCharacterId === null) {
      entries.push(
        report(fact, "inventory_item", "ambiguous", "ITEM_OWNER_DEPENDENCY_MISSING", null),
      );
      continue;
    }
    const definitionInventory = state.inventoryItems.filter(
      (value) => value.itemDefinitionId === definitionId,
    );
    const exactInventory = definitionInventory.filter((value) =>
      inventoryEquals(value, fact, ownerCharacterId),
    );
    let inventoryItemId: string;
    if (exactInventory.length === 1) {
      inventoryItemId = exactInventory[0]!.id;
      entries.push(
        report(fact, "inventory_item", "matched", "INVENTORY_ITEM_EXACT_MATCH", inventoryItemId),
      );
    } else if (exactInventory.length > 1 || definitionInventory.length > 0) {
      entries.push({
        ...report(fact, "inventory_item", "ambiguous", "INVENTORY_ITEM_AMBIGUOUS", null),
        relatedIds: definitionInventory.map((value) => value.id).sort(),
      });
      continue;
    } else {
      inventoryItemId = ids.nextId();
      inventory.push({
        id: inventoryItemId,
        itemDefinitionId: definitionId,
        ownerCharacterId,
        fact,
      });
      entries.push(
        report(
          fact,
          "inventory_item",
          "inserted",
          "INVENTORY_ITEM_INSERT_PLANNED",
          inventoryItemId,
        ),
      );
    }

    if (fact.equipmentSlot !== null && ownerCharacterId !== null) {
      const existing = state.equipment.find((value) => value.inventoryItemId === inventoryItemId);
      const occupant = state.equipment.find(
        (value) => value.characterId === ownerCharacterId && value.slot === fact.equipmentSlot,
      );
      if (
        existing?.characterId === ownerCharacterId &&
        existing.slot === fact.equipmentSlot &&
        occupant?.inventoryItemId === inventoryItemId
      ) {
        entries.push(
          report(fact, "equipment_assignment", "matched", "EQUIPMENT_EXACT_MATCH", inventoryItemId),
        );
      } else if (existing !== undefined || occupant !== undefined) {
        entries.push(
          report(
            fact,
            "equipment_assignment",
            "conflicts",
            "EQUIPMENT_SLOT_CONFLICT",
            inventoryItemId,
            true,
          ),
        );
      } else {
        equipment.push({
          inventoryItemId,
          characterId: ownerCharacterId,
          slot: fact.equipmentSlot,
        });
        entries.push(
          report(
            fact,
            "equipment_assignment",
            "inserted",
            "EQUIPMENT_INSERT_PLANNED",
            inventoryItemId,
          ),
        );
      }
    }
  }
  return {
    itemDefinitions: definitions,
    itemEffects: effects,
    inventoryItems: inventory,
    equipment,
    entries: sortEntries(entries),
    blocked: characters.blocked || entries.some((value) => value.category === "conflicts"),
  };
}

export function materializeItemDefinition(value: PlannedItemDefinitionInsert): ItemDefinition {
  const fact = value.fact;
  return {
    id: value.id,
    namePl: fact.namePl,
    normalizedNamePl: fact.normalizedNamePl,
    nameEn: null,
    typePl: fact.typePl,
    slot: fact.slot,
    rarityPl: fact.rarityPl,
    descriptionPl: null,
    verificationStatus: fact.verificationStatus,
    verificationConfidence: null,
    verificationSource: fact.verificationSource,
    fingerprint: fact.fingerprint,
    notes: combinedNotes(fact),
  };
}
export function materializeItemEffect(value: PlannedItemEffectInsert): ItemEffect {
  return {
    id: value.id,
    itemDefinitionId: value.itemDefinitionId,
    effectType: value.fact.effectType,
    numericValue: null,
    diceExpression: null,
    damageType: null,
    trigger: null,
    conditionTextPl: null,
    durationTextPl: null,
    descriptionPl: value.fact.descriptionPl,
    verificationStatus: value.fact.verificationStatus,
  };
}
export function materializeInventoryItem(value: PlannedInventoryItemInsert): InventoryItem {
  return {
    id: value.id,
    itemDefinitionId: value.itemDefinitionId,
    status: value.fact.placement.status,
    ownerCharacterId: value.ownerCharacterId,
    quantity: 1,
    obtainedAt: null,
    obtainedLocation: value.fact.placement.obtainedLocationPl,
    notes: value.fact.notes,
  };
}

function definitionEquals(value: ItemDefinition, fact: NormalizedLegacyItem): boolean {
  return (
    value.namePl === fact.namePl &&
    value.normalizedNamePl === fact.normalizedNamePl &&
    value.nameEn === null &&
    value.typePl === fact.typePl &&
    value.slot === fact.slot &&
    value.rarityPl === fact.rarityPl &&
    value.descriptionPl === null &&
    value.verificationStatus === fact.verificationStatus &&
    value.verificationConfidence === null &&
    value.verificationSource === fact.verificationSource &&
    value.fingerprint === fact.fingerprint &&
    value.notes === combinedNotes(fact)
  );
}
function effectEquals(
  value: ItemEffect,
  fact: NonNullable<NormalizedLegacyItem["effect"]>,
): boolean {
  return (
    value.effectType === fact.effectType &&
    value.numericValue === null &&
    value.diceExpression === null &&
    value.damageType === null &&
    value.trigger === null &&
    value.conditionTextPl === null &&
    value.durationTextPl === null &&
    value.descriptionPl === fact.descriptionPl &&
    value.verificationStatus === fact.verificationStatus
  );
}
function inventoryEquals(
  value: InventoryItem,
  fact: NormalizedLegacyItem,
  ownerCharacterId: string | null,
): boolean {
  return (
    value.status === fact.placement.status &&
    value.ownerCharacterId === ownerCharacterId &&
    value.quantity === 1 &&
    value.obtainedAt === null &&
    value.obtainedLocation === fact.placement.obtainedLocationPl &&
    value.notes === fact.notes
  );
}
function combinedNotes(fact: NormalizedLegacyItem): string | null {
  const parts = [
    fact.tagsSynergyPl === null ? null : `Tagi synergii: ${fact.tagsSynergyPl}`,
    fact.notes === null ? null : `Uwagi: ${fact.notes}`,
  ].filter((value): value is string => value !== null);
  return parts.length === 0 ? null : parts.join("\n");
}
function report(
  fact: NormalizedLegacyItem,
  entityKind: ImportReportEntry["entityKind"],
  category: ImportReportEntry["category"],
  reasonCode: string,
  canonicalEntityId: string | null,
  blocking = false,
): ImportReportEntry {
  return {
    category,
    entityKind,
    source: fact.source,
    sourceKey: fact.sourceKey,
    reasonCode,
    messagePl: messages[reasonCode] ?? "Fakt importu został sklasyfikowany.",
    blocking,
    canonicalEntityId,
    relatedIds: [],
  };
}
const messages: Readonly<Record<string, string>> = {
  ITEM_DEFINITION_INSERT_PLANNED: "Definicja przedmiotu zostanie dodana.",
  ITEM_DEFINITION_EXACT_MATCH: "Definicja przedmiotu jest już zgodna.",
  ITEM_DEFINITION_FACT_CONFLICT: "Istniejąca definicja przedmiotu ma sprzeczne fakty.",
  ITEM_DEFINITION_AMBIGUOUS: "Definicja przedmiotu ma wielu kandydatów.",
  ITEM_EFFECT_INSERT_PLANNED: "Efekt przedmiotu zostanie dodany.",
  ITEM_EFFECT_EXACT_MATCH: "Efekt przedmiotu jest już zgodny.",
  ITEM_EFFECT_FACT_CONFLICT: "Istniejący efekt przedmiotu jest sprzeczny.",
  INVENTORY_ITEM_INSERT_PLANNED: "Egzemplarz przedmiotu zostanie dodany.",
  INVENTORY_ITEM_EXACT_MATCH: "Egzemplarz przedmiotu jest już zgodny.",
  INVENTORY_ITEM_AMBIGUOUS: "Egzemplarz przedmiotu ma wielu kandydatów.",
  ITEM_OWNER_DEPENDENCY_MISSING: "Brakuje rozstrzygniętej postaci właściciela.",
  EQUIPMENT_INSERT_PLANNED: "Przypisanie wyposażenia zostanie dodane.",
  EQUIPMENT_EXACT_MATCH: "Przypisanie wyposażenia jest już zgodne.",
  EQUIPMENT_SLOT_CONFLICT: "Docelowy slot wyposażenia jest zajęty albo przypisanie jest inne.",
};
function sortEntries(entries: readonly ImportReportEntry[]): readonly ImportReportEntry[] {
  return [...entries].sort(
    (a, b) => a.source.row - b.source.row || a.entityKind.localeCompare(b.entityKind, "pl-PL"),
  );
}
