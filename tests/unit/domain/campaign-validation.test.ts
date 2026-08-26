import { describe, expect, it } from "vitest";

import type {
  CharacterAttribute,
  CharacterSpell,
  EquipmentAssignment,
  InventoryItem,
  ItemDefinition,
  PermanentModifier,
} from "../../../src/domain/model/campaign.js";
import {
  calculateEffectiveAttribute,
  CampaignValidationError,
  assertValidCampaignState,
  validateCampaignState,
  type CampaignValidationStateReader,
} from "../../../src/domain/validation/campaign-validation.js";

const attribute: CharacterAttribute = { characterId: "hero", attribute: "STR", baseValue: 17 };
const modifier = (overrides: Partial<PermanentModifier> = {}): PermanentModifier => ({
  id: "modifier",
  characterId: "hero",
  targetType: "ATTRIBUTE",
  targetKey: "STR",
  modifier: 2,
  sourceNamePl: "Mikstura wiecznej siły",
  sourceItemDefinitionId: null,
  provenanceType: "USER_CONFIRMED",
  permanent: true,
  active: true,
  notes: null,
  createdAt: new Date("2026-08-26T10:00:00.000Z"),
  ...overrides,
});

describe("campaign validation", () => {
  it("derives effective attributes only from active permanent matching modifiers", () => {
    expect(
      calculateEffectiveAttribute(attribute, [
        modifier(),
        modifier({ id: "inactive", modifier: 5, active: false }),
        modifier({ id: "temporary", modifier: 7, permanent: false }),
        modifier({ id: "dex", targetKey: "DEX", modifier: 3 }),
      ]),
    ).toBe(19);
    expect(attribute.baseValue).toBe(17);
  });

  it("reports deterministic equipment, ownership, slot, quantity, modifier and spell violations", () => {
    const equipment: EquipmentAssignment[] = [
      { inventoryItemId: "item-1", characterId: "hero", slot: "HEAD" },
      { inventoryItemId: "item-1", characterId: "hero", slot: "HEAD" },
      { inventoryItemId: "missing", characterId: "hero", slot: "HEAD" },
    ];
    const inventory: InventoryItem[] = [
      {
        id: "item-1",
        itemDefinitionId: "ring",
        status: "CHEST",
        ownerCharacterId: "other-character",
        quantity: 0,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      },
      {
        id: "equipped-without-slot",
        itemDefinitionId: "ring",
        status: "EQUIPPED",
        ownerCharacterId: "hero",
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      },
    ];
    const definitions = [
      {
        id: "ring",
        namePl: "Pierścień",
        normalizedNamePl: "pierscien",
        nameEn: null,
        typePl: null,
        slot: "RING",
        rarityPl: null,
        descriptionPl: null,
        verificationStatus: "UNKNOWN",
        verificationConfidence: null,
        verificationSource: null,
        fingerprint: null,
        notes: null,
      } satisfies ItemDefinition,
    ];
    const spells: CharacterSpell[] = [
      {
        characterId: "hero",
        spellId: "spell",
        source: "CLASS",
        known: false,
        prepared: true,
        alwaysPrepared: false,
        notes: null,
      },
    ];
    const reader = state({
      equipment,
      inventory,
      definitions,
      modifiers: [modifier({ permanent: false, sourceNamePl: " " })],
      spells,
    });

    const violations = validateCampaignState(reader);
    const codes = new Set(violations.map((value) => value.code));
    expect(codes).toEqual(
      new Set([
        "EQUIPMENT_DUPLICATE_INSTANCE",
        "EQUIPMENT_DUPLICATE_SLOT",
        "EQUIPMENT_INVENTORY_MISSING",
        "EQUIPMENT_STATUS_MISMATCH",
        "EQUIPMENT_OWNER_MISMATCH",
        "EQUIPMENT_SLOT_MISMATCH",
        "INVENTORY_QUANTITY_INVALID",
        "INVENTORY_EQUIPMENT_MISSING",
        "INVENTORY_OWNER_INVALID",
        "MODIFIER_PROVENANCE_INVALID",
        "MODIFIER_PERMANENCE_INVALID",
        "SPELL_PREPARATION_INVALID",
      ]),
    );
    expect(() => assertValidCampaignState(reader)).toThrow(CampaignValidationError);
    expect(violations).toEqual(
      [...violations].sort((left, right) =>
        `${left.code}:${left.entityIds.join(":")}`.localeCompare(
          `${right.code}:${right.entityIds.join(":")}`,
          "en",
        ),
      ),
    );
  });

  it("allows a not-known spell when always-prepared explicitly explains availability", () => {
    const reader = state({
      spells: [
        {
          characterId: "hero",
          spellId: "spell-from-item",
          source: "ITEM",
          known: false,
          prepared: true,
          alwaysPrepared: true,
          notes: null,
        },
      ],
    });

    expect(validateCampaignState(reader)).toEqual([]);
  });
});

function state(values: {
  equipment?: readonly EquipmentAssignment[];
  inventory?: readonly InventoryItem[];
  definitions?: readonly ItemDefinition[];
  modifiers?: readonly PermanentModifier[];
  spells?: readonly CharacterSpell[];
}): CampaignValidationStateReader {
  return {
    listAllEquipment: () => values.equipment ?? [],
    listAllInventoryItems: () => values.inventory ?? [],
    listAllItemDefinitions: () => values.definitions ?? [],
    listAllPermanentModifiers: () => values.modifiers ?? [],
    listAllCharacterSpells: () => values.spells ?? [],
  };
}
