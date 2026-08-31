import {
  ATTRIBUTE_KEYS,
  EQUIPMENT_SLOTS,
  INVENTORY_STATUSES,
  ITEM_SLOTS,
  type Character,
  type CharacterAttribute,
  type InventoryStatus,
  type ItemDefinition,
  type ItemEffect,
  type PermanentModifier,
} from "../../domain/model/campaign.js";
import { normalizePolishMatchingKey } from "../../domain/naming/polish-matching.js";
import {
  calculateEffectiveAttribute,
  isEquipmentSlotCompatible,
} from "../../domain/validation/campaign-validation.js";
import {
  CampaignInspectionError,
  DEFAULT_CHANGE_LIMIT,
  MAX_CHANGE_LIMIT,
  type CampaignInspectionReadPort,
  type ChangesView,
  type CharacterIdentityView,
  type CharacterView,
  type EffectiveAttributeView,
  type EquipmentView,
  type IllithidView,
  type InventoryFilters,
  type InventoryView,
  type PartyView,
  type SpellsView,
} from "./campaign-inspection.js";

const itemSlotSet = new Set<string>(ITEM_SLOTS);
const inventoryStatusSet = new Set<string>(INVENTORY_STATUSES);

export class CampaignInspectionService {
  public constructor(private readonly source: CampaignInspectionReadPort) {}

  public getParty(): PartyView {
    return this.source.read((session) => ({
      characters: session
        .listCharacters()
        .filter((character) => character.activeParty)
        .map((character) => ({
          ...identity(character),
          classPl: character.classPl,
          subclassPl: character.subclassPl,
          level: character.level,
          roleSummary: character.roleSummary,
          attributes: effectiveAttributes(
            session.listCharacterAttributes(character.id),
            session.listPermanentModifiers(character.id),
          ),
        }))
        .sort(compareByDisplayName),
    }));
  }

  public getCharacter(name: string): CharacterView {
    return this.source.read((session) => {
      const character = resolveCharacter(session.listCharacters(), name);
      const attributes = session.listCharacterAttributes(character.id);
      const modifiers = sortModifiers(session.listPermanentModifiers(character.id));
      const definitions = new Map(session.listAbilities().map((value) => [value.id, value]));
      const abilities = session
        .listCharacterAbilities(character.id)
        .map((assignment) => ({
          assignment,
          definition: required(definitions, assignment.abilityId, "ability"),
        }))
        .sort(
          (left, right) =>
            comparePolish(left.definition.namePl, right.definition.namePl) ||
            compareText(left.assignment.source, right.assignment.source) ||
            compareText(left.definition.id, right.definition.id),
        );
      return {
        character,
        attributes: effectiveAttributes(attributes, modifiers),
        permanentModifiers: modifiers,
        abilities,
      };
    });
  }

  public getEquipment(name: string): EquipmentView {
    return this.source.read((session) => {
      const character = resolveCharacter(session.listCharacters(), name);
      const inventory = new Map(session.listInventoryItems().map((value) => [value.id, value]));
      const definitions = new Map(session.listItemDefinitions().map((value) => [value.id, value]));
      const effects = effectsByDefinition(session.listItemEffects());
      const assignments = session.listEquipment(character.id);
      const assignedItemIds = new Set(assignments.map((value) => value.inventoryItemId));
      const missingAssignment = [...inventory.values()].find(
        (item) =>
          item.status === "EQUIPPED" &&
          item.ownerCharacterId === character.id &&
          !assignedItemIds.has(item.id),
      );
      if (missingAssignment !== undefined) {
        inconsistentEquipment(missingAssignment.id, character.id, null);
      }
      const items = assignments
        .map((assignment) => {
          const inventoryItem = required(inventory, assignment.inventoryItemId, "inventory item");
          const definition = required(
            definitions,
            inventoryItem.itemDefinitionId,
            "item definition",
          );
          assertConsistentEquipmentView(assignment, inventoryItem, definition);
          return {
            assignment,
            inventoryItem,
            definition,
            effects: effects.get(definition.id) ?? [],
          };
        })
        .sort(
          (left, right) =>
            EQUIPMENT_SLOTS.indexOf(left.assignment.slot) -
              EQUIPMENT_SLOTS.indexOf(right.assignment.slot) ||
            compareText(left.inventoryItem.id, right.inventoryItem.id),
        );
      return { character: identity(character), items };
    });
  }

  public findInventory(filters: InventoryFilters = {}): InventoryView {
    const normalized = normalizeFilters(filters);
    return this.source.read((session) => {
      const definitions = new Map(session.listItemDefinitions().map((value) => [value.id, value]));
      const effects = effectsByDefinition(session.listItemEffects());
      const characters = new Map(session.listCharacters().map((value) => [value.id, value]));
      const equipment = new Map(
        session.listEquipment().map((value) => [value.inventoryItemId, value]),
      );
      const items = session
        .listInventoryItems()
        .filter(
          (inventoryItem) =>
            normalized.statuses.length === 0 || normalized.statuses.includes(inventoryItem.status),
        )
        .map((inventoryItem) => {
          const definition = required(
            definitions,
            inventoryItem.itemDefinitionId,
            "item definition",
          );
          const itemEffects = effects.get(definition.id) ?? [];
          return { inventoryItem, definition, effects: itemEffects };
        })
        .filter((item) =>
          matchesInventory(item.definition, item.effects, item.inventoryItem.status, normalized),
        )
        .map(({ inventoryItem, definition, effects: itemEffects }) => {
          const owner =
            inventoryItem.ownerCharacterId === null
              ? null
              : identity(required(characters, inventoryItem.ownerCharacterId, "character"));
          const assignment = equipment.get(inventoryItem.id) ?? null;
          assertConsistentInventoryEquipmentView(assignment, inventoryItem, definition);
          return {
            inventoryItem,
            definition,
            effects: itemEffects,
            owner,
            equipment: assignment,
          };
        })
        .sort(compareInventory);
      return { filters: normalized, items };
    });
  }

  public getSpells(name: string): SpellsView {
    return this.source.read((session) => {
      const character = resolveCharacter(session.listCharacters(), name);
      const definitions = new Map(session.listSpells().map((value) => [value.id, value]));
      const spells = session
        .listCharacterSpells(character.id)
        .map((assignment) => ({
          assignment,
          definition: required(definitions, assignment.spellId, "spell"),
        }))
        .sort(
          (left, right) =>
            left.definition.level - right.definition.level ||
            comparePolish(left.definition.namePl, right.definition.namePl) ||
            compareText(left.assignment.source, right.assignment.source) ||
            compareText(left.definition.id, right.definition.id),
        );
      return { character: identity(character), spells };
    });
  }

  public getIllithid(name?: string): IllithidView {
    return this.source.read((session) => {
      const character =
        name === undefined ? null : resolveCharacter(session.listCharacters(), name);
      const acquisitions = new Map(
        (character === null ? [] : session.listCharacterIllithidPowers(character.id)).map(
          (value) => [value.powerId, value],
        ),
      );
      const prerequisites = new Map<string, string[]>();
      for (const relation of session.listIllithidPrerequisites()) {
        const current = prerequisites.get(relation.powerId) ?? [];
        current.push(relation.prerequisitePowerId);
        prerequisites.set(relation.powerId, current);
      }
      const powers = session
        .listIllithidPowers()
        .map((definition) => ({
          definition,
          prerequisitePowerIds: [...(prerequisites.get(definition.id) ?? [])].sort(compareText),
          acquisition: acquisitions.get(definition.id) ?? null,
        }))
        .sort(
          (left, right) =>
            compareNullableTier(left.definition.tier, right.definition.tier) ||
            comparePolish(left.definition.namePl, right.definition.namePl) ||
            compareText(left.definition.id, right.definition.id),
        );
      return { character: character === null ? null : identity(character), powers };
    });
  }

  public getChanges(limit: number = DEFAULT_CHANGE_LIMIT): ChangesView {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CHANGE_LIMIT) {
      throw new CampaignInspectionError(
        "INVALID_LIMIT",
        `Limit zmian musi być liczbą całkowitą od 1 do ${MAX_CHANGE_LIMIT}.`,
        { limit, maximum: MAX_CHANGE_LIMIT },
      );
    }
    return this.source.read((session) => ({
      limit,
      changes: session.listRecentChanges(limit),
    }));
  }
}

function assertConsistentEquipmentView(
  assignment: EquipmentView["items"][number]["assignment"],
  inventoryItem: EquipmentView["items"][number]["inventoryItem"],
  definition: EquipmentView["items"][number]["definition"],
): void {
  const consistent =
    inventoryItem.status === "EQUIPPED" &&
    inventoryItem.ownerCharacterId === assignment.characterId &&
    inventoryItem.quantity === 1 &&
    isEquipmentSlotCompatible(assignment.slot, definition.slot);
  if (consistent) return;
  inconsistentEquipment(inventoryItem.id, assignment.characterId, assignment.slot);
}

function assertConsistentInventoryEquipmentView(
  assignment: EquipmentView["items"][number]["assignment"] | null,
  inventoryItem: EquipmentView["items"][number]["inventoryItem"],
  definition: EquipmentView["items"][number]["definition"],
): void {
  if (assignment !== null) {
    assertConsistentEquipmentView(assignment, inventoryItem, definition);
    return;
  }
  if (inventoryItem.status === "EQUIPPED") {
    inconsistentEquipment(inventoryItem.id, inventoryItem.ownerCharacterId, null);
  }
}

function inconsistentEquipment(
  inventoryItemId: string,
  characterId: string | null,
  equipmentSlot: string | null,
): never {
  throw new CampaignInspectionError(
    "INCONSISTENT_STATE",
    "Stan kampanii ma niespójne przypisanie wyposażenia.",
    {
      inventoryItemId,
      characterId,
      equipmentSlot,
    },
  );
}

function resolveCharacter(characters: readonly Character[], input: string): Character {
  const name = input.normalize("NFC").trim();
  const canonical = characters.find((character) => character.canonicalName === name);
  if (canonical !== undefined) return canonical;
  const key = normalizePolishMatchingKey(name);
  const matches = characters
    .filter((character) => normalizePolishMatchingKey(character.displayNamePl) === key)
    .sort((left, right) => compareText(left.id, right.id));
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    throw new CampaignInspectionError("CHARACTER_NOT_FOUND", "Nie znaleziono postaci.", {
      name,
    });
  }
  throw new CampaignInspectionError("CHARACTER_AMBIGUOUS", "Nazwa postaci jest niejednoznaczna.", {
    name,
    candidates: matches.map(identity),
  });
}

function identity(character: Character): CharacterIdentityView {
  return {
    id: character.id,
    canonicalName: character.canonicalName,
    displayNamePl: character.displayNamePl,
  };
}

function effectiveAttributes(
  attributes: readonly CharacterAttribute[],
  modifiers: readonly PermanentModifier[],
): readonly EffectiveAttributeView[] {
  return [...attributes]
    .sort(
      (left, right) =>
        ATTRIBUTE_KEYS.indexOf(left.attribute) - ATTRIBUTE_KEYS.indexOf(right.attribute),
    )
    .map((attribute) => ({
      attribute: attribute.attribute,
      baseValue: attribute.baseValue,
      effectiveValue: calculateEffectiveAttribute(attribute, modifiers),
    }));
}

function sortModifiers(modifiers: readonly PermanentModifier[]): readonly PermanentModifier[] {
  return [...modifiers].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() || compareText(left.id, right.id),
  );
}

function effectsByDefinition(
  effects: readonly ItemEffect[],
): ReadonlyMap<string, readonly ItemEffect[]> {
  const result = new Map<string, ItemEffect[]>();
  for (const effect of effects) {
    const current = result.get(effect.itemDefinitionId) ?? [];
    current.push(effect);
    result.set(effect.itemDefinitionId, current);
  }
  for (const values of result.values())
    values.sort((left, right) => compareText(left.id, right.id));
  return result;
}

function normalizeFilters(filters: InventoryFilters): Required<InventoryFilters> {
  const slots = unique(filters.slots ?? []);
  const statuses = unique(filters.statuses ?? []);
  const tags = unique((filters.tags ?? []).map(normalizePolishMatchingKey));
  if (slots.some((value) => !itemSlotSet.has(value))) invalidFilter("slot", slots);
  if (statuses.some((value) => !inventoryStatusSet.has(value))) invalidFilter("status", statuses);
  if (tags.some((value) => value === "")) invalidFilter("tag", tags);
  return { slots, statuses, tags };
}

function invalidFilter(name: string, values: readonly string[]): never {
  throw new CampaignInspectionError("INVALID_FILTER", `Niepoprawny filtr inventory: ${name}.`, {
    filter: name,
    values,
  });
}

function matchesInventory(
  definition: ItemDefinition,
  effects: readonly ItemEffect[],
  status: InventoryStatus,
  filters: Required<InventoryFilters>,
): boolean {
  if (
    filters.slots.length > 0 &&
    (definition.slot === null || !filters.slots.includes(definition.slot))
  )
    return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(status)) return false;
  if (filters.tags.length === 0) return true;
  const facets = new Set(
    effects.flatMap((effect) =>
      [effect.effectType, effect.damageType, effect.trigger]
        .filter((value): value is string => value !== null)
        .map(normalizePolishMatchingKey),
    ),
  );
  return filters.tags.some((tag) => facets.has(tag));
}

function compareByDisplayName(left: CharacterIdentityView, right: CharacterIdentityView): number {
  return comparePolish(left.displayNamePl, right.displayNamePl) || compareText(left.id, right.id);
}

function compareInventory(
  left: InventoryView["items"][number],
  right: InventoryView["items"][number],
): number {
  return (
    INVENTORY_STATUSES.indexOf(left.inventoryItem.status) -
      INVENTORY_STATUSES.indexOf(right.inventoryItem.status) ||
    comparePolish(left.definition.namePl, right.definition.namePl) ||
    compareText(left.owner?.id ?? "", right.owner?.id ?? "") ||
    compareText(left.equipment?.slot ?? "", right.equipment?.slot ?? "") ||
    compareText(left.inventoryItem.id, right.inventoryItem.id)
  );
}

function compareNullableTier(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
}

function comparePolish(left: string, right: string): number {
  return left.localeCompare(right, "pl-PL") || compareText(left, right);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function required<T>(values: ReadonlyMap<string, T>, id: string, kind: string): T {
  const value = values.get(id);
  if (value !== undefined) return value;
  throw new CampaignInspectionError("INCONSISTENT_STATE", "Stan kampanii ma niespójne odwołanie.", {
    kind,
    id,
  });
}
