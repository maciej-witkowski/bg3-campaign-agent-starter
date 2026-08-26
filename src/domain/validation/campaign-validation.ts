import type {
  AttributeKey,
  CharacterAttribute,
  CharacterSpell,
  EquipmentAssignment,
  InventoryItem,
  ItemDefinition,
  PermanentModifier,
} from "../model/campaign.js";

export const CAMPAIGN_VALIDATION_CODES = [
  "EQUIPMENT_DUPLICATE_INSTANCE",
  "EQUIPMENT_DUPLICATE_SLOT",
  "EQUIPMENT_INVENTORY_MISSING",
  "EQUIPMENT_STATUS_MISMATCH",
  "EQUIPMENT_OWNER_MISMATCH",
  "EQUIPMENT_DEFINITION_MISSING",
  "EQUIPMENT_SLOT_MISMATCH",
  "INVENTORY_QUANTITY_INVALID",
  "INVENTORY_EQUIPMENT_MISSING",
  "INVENTORY_OWNER_INVALID",
  "MODIFIER_TARGET_INVALID",
  "MODIFIER_PROVENANCE_INVALID",
  "MODIFIER_PERMANENCE_INVALID",
  "SPELL_PREPARATION_INVALID",
] as const;

export type CampaignValidationCode = (typeof CAMPAIGN_VALIDATION_CODES)[number];

export interface CampaignValidationViolation {
  readonly code: CampaignValidationCode;
  readonly entityIds: readonly string[];
  readonly message: string;
}

export class CampaignValidationError extends Error {
  public override readonly name = "CampaignValidationError";

  public constructor(public readonly violations: readonly CampaignValidationViolation[]) {
    super(`Stan kampanii narusza ${violations.length} reguł.`);
  }
}

export interface CampaignValidationStateReader {
  listAllEquipment(): readonly EquipmentAssignment[];
  listAllInventoryItems(): readonly InventoryItem[];
  listAllItemDefinitions(): readonly ItemDefinition[];
  listAllPermanentModifiers(): readonly PermanentModifier[];
  listAllCharacterSpells(): readonly CharacterSpell[];
}

const slotCompatibility: Readonly<Record<EquipmentAssignment["slot"], ItemDefinition["slot"]>> = {
  HEAD: "HEAD",
  CLOAK: "CLOAK",
  BODY: "BODY",
  HANDS: "HANDS",
  FEET: "FEET",
  NECK: "NECK",
  RING_1: "RING",
  RING_2: "RING",
  MAIN_HAND: "MAIN_HAND",
  OFF_HAND: "OFF_HAND",
  RANGED_MAIN_HAND: "RANGED",
  RANGED_OFF_HAND: "RANGED",
  INSTRUMENT: "INSTRUMENT",
};

export function calculateEffectiveAttribute(
  attribute: CharacterAttribute,
  modifiers: readonly PermanentModifier[],
): number {
  return modifiers
    .filter(
      (modifier) =>
        modifier.characterId === attribute.characterId &&
        modifier.targetType === "ATTRIBUTE" &&
        modifier.targetKey === attribute.attribute &&
        modifier.permanent &&
        modifier.active,
    )
    .reduce((value, modifier) => value + modifier.modifier, attribute.baseValue);
}

export function calculateEffectiveAttributes(
  attributes: readonly CharacterAttribute[],
  modifiers: readonly PermanentModifier[],
): ReadonlyMap<AttributeKey, number> {
  return new Map(
    attributes.map((attribute) => [
      attribute.attribute,
      calculateEffectiveAttribute(attribute, modifiers),
    ]),
  );
}

export function validateCampaignState(
  state: CampaignValidationStateReader,
): readonly CampaignValidationViolation[] {
  const violations: CampaignValidationViolation[] = [];
  const inventory = state.listAllInventoryItems();
  const equipment = state.listAllEquipment();
  const definitions = new Map(state.listAllItemDefinitions().map((item) => [item.id, item]));
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const equipmentCount = new Map<string, number>();
  const occupiedSlots = new Map<string, number>();

  for (const assignment of equipment) {
    equipmentCount.set(
      assignment.inventoryItemId,
      (equipmentCount.get(assignment.inventoryItemId) ?? 0) + 1,
    );
    const occupiedKey = `${assignment.characterId}:${assignment.slot}`;
    occupiedSlots.set(occupiedKey, (occupiedSlots.get(occupiedKey) ?? 0) + 1);

    const item = inventoryById.get(assignment.inventoryItemId);
    if (item === undefined) {
      violations.push(violation("EQUIPMENT_INVENTORY_MISSING", [assignment.inventoryItemId]));
      continue;
    }
    if (item.status !== "EQUIPPED") {
      violations.push(violation("EQUIPMENT_STATUS_MISMATCH", [item.id]));
    }
    if (item.ownerCharacterId !== assignment.characterId) {
      violations.push(violation("EQUIPMENT_OWNER_MISMATCH", [item.id, assignment.characterId]));
    }
    const definition = definitions.get(item.itemDefinitionId);
    if (definition === undefined) {
      violations.push(violation("EQUIPMENT_DEFINITION_MISSING", [item.id, item.itemDefinitionId]));
    } else if (definition.slot !== null && definition.slot !== slotCompatibility[assignment.slot]) {
      violations.push(violation("EQUIPMENT_SLOT_MISMATCH", [item.id, definition.id]));
    }
  }

  for (const [id, count] of equipmentCount) {
    if (count > 1) violations.push(violation("EQUIPMENT_DUPLICATE_INSTANCE", [id]));
  }
  for (const [key, count] of occupiedSlots) {
    if (count > 1) violations.push(violation("EQUIPMENT_DUPLICATE_SLOT", key.split(":")));
  }
  for (const item of inventory) {
    if (item.quantity <= 0) violations.push(violation("INVENTORY_QUANTITY_INVALID", [item.id]));
    if ((item.status === "CHEST" || item.status === "SOLD") && item.ownerCharacterId !== null) {
      violations.push(violation("INVENTORY_OWNER_INVALID", [item.id, item.ownerCharacterId]));
    }
    const count = equipmentCount.get(item.id) ?? 0;
    if (item.status === "EQUIPPED" && count !== 1) {
      violations.push(violation("INVENTORY_EQUIPMENT_MISSING", [item.id]));
    }
    if (item.status !== "EQUIPPED" && count > 0) {
      violations.push(violation("EQUIPMENT_STATUS_MISMATCH", [item.id]));
    }
  }

  for (const modifier of state.listAllPermanentModifiers()) {
    if (modifier.targetType !== "ATTRIBUTE") {
      violations.push(violation("MODIFIER_TARGET_INVALID", [modifier.id]));
    }
    if (!modifier.permanent) {
      violations.push(violation("MODIFIER_PERMANENCE_INVALID", [modifier.id]));
    }
    if (modifier.sourceNamePl.trim() === "" || modifier.provenanceType.trim() === "") {
      violations.push(violation("MODIFIER_PROVENANCE_INVALID", [modifier.id]));
    }
  }

  for (const spell of state.listAllCharacterSpells()) {
    if (spell.prepared && !spell.known && !spell.alwaysPrepared) {
      violations.push(
        violation("SPELL_PREPARATION_INVALID", [spell.characterId, spell.spellId, spell.source]),
      );
    }
  }

  return violations.sort((left, right) =>
    `${left.code}:${left.entityIds.join(":")}`.localeCompare(
      `${right.code}:${right.entityIds.join(":")}`,
      "en",
    ),
  );
}

export function assertValidCampaignState(state: CampaignValidationStateReader): void {
  const violations = validateCampaignState(state);
  if (violations.length > 0) throw new CampaignValidationError(violations);
}

function violation(
  code: CampaignValidationCode,
  entityIds: readonly string[],
): CampaignValidationViolation {
  return { code, entityIds, message: validationMessages[code] };
}

const validationMessages: Readonly<Record<CampaignValidationCode, string>> = {
  EQUIPMENT_DUPLICATE_INSTANCE: "Jedna instancja przedmiotu zajmuje więcej niż jedno miejsce.",
  EQUIPMENT_DUPLICATE_SLOT: "Jedna pozycja ekwipunku jest zajęta więcej niż raz.",
  EQUIPMENT_INVENTORY_MISSING: "Przypisanie ekwipunku nie ma instancji w inwentarzu.",
  EQUIPMENT_STATUS_MISMATCH: "Status instancji nie zgadza się z przypisaniem ekwipunku.",
  EQUIPMENT_OWNER_MISMATCH: "Właściciel instancji nie zgadza się z postacią ekwipunku.",
  EQUIPMENT_DEFINITION_MISSING: "Instancja ekwipunku nie ma definicji przedmiotu.",
  EQUIPMENT_SLOT_MISMATCH: "Znany typ przedmiotu nie pasuje do pozycji ekwipunku.",
  INVENTORY_QUANTITY_INVALID: "Ilość instancji przedmiotu musi być dodatnia.",
  INVENTORY_EQUIPMENT_MISSING: "Instancja oznaczona jako założona nie ma przypisania.",
  MODIFIER_TARGET_INVALID: "Modyfikator trwały ma nieobsługiwany cel.",
  INVENTORY_OWNER_INVALID: "Przedmiot w skrzyni lub sprzedany nie może mieć właściciela.",
  MODIFIER_PROVENANCE_INVALID: "Modyfikator trwały nie ma kompletnej proweniencji.",
  MODIFIER_PERMANENCE_INVALID: "Rekord modyfikatora trwałego nie jest oznaczony jako trwały.",
  SPELL_PREPARATION_INVALID:
    "Przygotowane nieznane zaklęcie musi być jawnie oznaczone jako zawsze przygotowane.",
};
