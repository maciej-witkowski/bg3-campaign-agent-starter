import { describe, expect, it } from "vitest";

import type { CampaignImportState } from "../../../src/application/import/campaign-import-state.js";
import type { NormalizedLegacyCampaign } from "../../../src/application/import/legacy-campaign-normalizer.js";
import type { LegacyCharacterImportPlan } from "../../../src/application/import/legacy-character-import-planner.js";
import {
  materializeInventoryItem,
  materializeItemDefinition,
  materializeItemEffect,
  planLegacyItemImport,
} from "../../../src/application/import/legacy-item-import-planner.js";
import type { NormalizedLegacyItem } from "../../../src/application/import/legacy-item-normalizer.js";
import { LEGACY_TRACKER_PROFILE } from "../../../src/application/import/legacy-tracker-stage.js";
import { planningDecisionKey } from "../../../src/application/import/reconciliation-decisions.js";

describe("legacy item import planner", () => {
  it("plans the complete item dependency closure for a clean campaign", () => {
    const plan = planLegacyItemImport(campaign(), emptyState(), characterPlan(), ids());
    expect(plan.blocked).toBe(false);
    expect(plan.itemDefinitions).toHaveLength(1);
    expect(plan.itemEffects).toHaveLength(1);
    expect(plan.inventoryItems).toHaveLength(1);
    expect(plan.equipment).toEqual([
      { inventoryItemId: "id-3", characterId: "character-1", slot: "MAIN_HAND" },
    ]);
    expect(materializeItemDefinition(plan.itemDefinitions[0]!)).toMatchObject({
      id: "id-1",
      namePl: "Miecz Astralnej Równiny",
      notes: "Tagi synergii: atak\nUwagi: Z testu",
    });
    expect(materializeItemEffect(plan.itemEffects[0]!)).toMatchObject({
      id: "id-2",
      itemDefinitionId: "id-1",
      descriptionPl: "+1 do ataku",
    });
    expect(materializeInventoryItem(plan.inventoryItems[0]!)).toMatchObject({
      id: "id-3",
      ownerCharacterId: "character-1",
      status: "EQUIPPED",
    });
  });

  it("makes an exact second plan a no-op with matched report entries", () => {
    const first = planLegacyItemImport(campaign(), emptyState(), characterPlan(), ids());
    const state: CampaignImportState = {
      ...emptyState(),
      itemDefinitions: [materializeItemDefinition(first.itemDefinitions[0]!)],
      itemEffects: [materializeItemEffect(first.itemEffects[0]!)],
      inventoryItems: [materializeInventoryItem(first.inventoryItems[0]!)],
      equipment: first.equipment,
    };
    const second = planLegacyItemImport(campaign(), state, characterPlan(), ids());
    expect(second.blocked).toBe(false);
    expect(second.itemDefinitions).toEqual([]);
    expect(second.itemEffects).toEqual([]);
    expect(second.inventoryItems).toEqual([]);
    expect(second.equipment).toEqual([]);
    expect(second.entries.every((entry) => entry.category === "matched")).toBe(true);
  });

  it("omits an ambiguous same-name definition and blocks an incompatible fingerprint match", () => {
    const definition = materializeItemDefinition(
      planLegacyItemImport(campaign(), emptyState(), characterPlan(), ids()).itemDefinitions[0]!,
    );
    const ambiguous = planLegacyItemImport(
      campaign(),
      {
        ...emptyState(),
        itemDefinitions: [{ ...definition, id: "candidate", fingerprint: "other" }],
      },
      characterPlan(),
      ids(),
    );
    expect(ambiguous.blocked).toBe(false);
    expect(ambiguous.itemDefinitions).toEqual([]);
    expect(ambiguous.entries[0]).toMatchObject({
      category: "ambiguous",
      relatedIds: ["candidate"],
    });

    const conflict = planLegacyItemImport(
      campaign(),
      { ...emptyState(), itemDefinitions: [{ ...definition, typePl: "Tarcza" }] },
      characterPlan(),
      ids(),
    );
    expect(conflict.blocked).toBe(true);
    expect(conflict.entries[0]).toMatchObject({
      category: "conflicts",
      reasonCode: "ITEM_DEFINITION_FACT_CONFLICT",
    });
  });

  it("applies select-existing, treat-as-new and skip decisions to an ambiguous definition", () => {
    const definition = materializeItemDefinition(
      planLegacyItemImport(campaign(), emptyState(), characterPlan(), ids()).itemDefinitions[0]!,
    );
    const state = {
      ...emptyState(),
      itemDefinitions: [{ ...definition, id: "candidate", fingerprint: "other" }],
    };
    const key = planningDecisionKey("item_definition", item().source, "ITEM_DEFINITION_AMBIGUOUS");

    const selected = planLegacyItemImport(
      campaign(),
      state,
      characterPlan(),
      ids(),
      new Map([[key, { action: "select_existing", canonicalEntityId: "candidate" }]]),
    );
    expect(selected.entries).toContainEqual(
      expect.objectContaining({ category: "matched", reasonCode: "RECONCILED_SELECT_EXISTING" }),
    );
    expect(selected.inventoryItems).toHaveLength(1);

    const inserted = planLegacyItemImport(
      campaign(),
      state,
      characterPlan(),
      ids(),
      new Map([[key, { action: "treat_as_new" }]]),
    );
    expect(inserted.itemDefinitions).toHaveLength(1);
    expect(inserted.entries).toContainEqual(
      expect.objectContaining({ category: "inserted", reasonCode: "RECONCILED_TREAT_AS_NEW" }),
    );

    const skipped = planLegacyItemImport(
      campaign(),
      state,
      characterPlan(),
      ids(),
      new Map([[key, { action: "skip" }]]),
    );
    expect(skipped.itemDefinitions).toEqual([]);
    expect(skipped.inventoryItems).toEqual([]);
    expect(skipped.entries).toEqual([
      expect.objectContaining({ category: "skipped", reasonCode: "RECONCILED_SKIP" }),
    ]);
  });
});

function campaign(): NormalizedLegacyCampaign {
  return {
    workbookProfile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "a".repeat(64),
    characters: [],
    items: [item()],
    abilities: [],
    spells: [],
    illithidPowers: [],
    issues: [],
    skipped: [],
  };
}
function item(): NormalizedLegacyItem {
  return {
    sourceKey: "item:fp",
    source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Przedmioty", row: 2, field: null },
    namePl: "Miecz Astralnej Równiny",
    normalizedNamePl: "miecz astralnej równiny",
    nameEn: null,
    unresolvedAliasEn: null,
    typePl: "Broń",
    slot: "MAIN_HAND",
    rarityPl: null,
    verificationStatus: "VERIFIED",
    verificationSource: "POTWIERDZONE W GRZE",
    fingerprint: "import-v1:fp",
    tagsSynergyPl: "atak",
    notes: "Z testu",
    effect: {
      effectType: "LEGACY_TEXT",
      descriptionPl: "+1 do ataku",
      verificationStatus: "VERIFIED",
    },
    placement: {
      status: "EQUIPPED",
      ownerCharacterCanonicalName: "LAEZEL",
      obtainedLocationPl: null,
      quantity: 1,
    },
    equipmentSlot: "MAIN_HAND",
  };
}
function characterPlan(): LegacyCharacterImportPlan {
  return {
    characters: [],
    attributes: [],
    permanentModifiers: [],
    characterIdsByCanonicalName: new Map([["LAEZEL", "character-1"]]),
    entries: [],
    blocked: false,
  };
}
function emptyState(): CampaignImportState {
  return {
    characters: [],
    characterAttributes: [],
    permanentModifiers: [],
    itemDefinitions: [],
    itemEffects: [],
    inventoryItems: [],
    equipment: [],
    spells: [],
    characterSpells: [],
    abilities: [],
    characterAbilities: [],
    illithidPowers: [],
    illithidPowerPrerequisites: [],
    characterIllithidPowers: [],
  };
}
function ids() {
  let value = 0;
  return { nextId: () => `id-${++value}` };
}
