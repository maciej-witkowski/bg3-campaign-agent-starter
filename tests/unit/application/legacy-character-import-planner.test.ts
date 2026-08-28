import { describe, expect, it } from "vitest";

import type { CampaignImportState } from "../../../src/application/import/campaign-import-state.js";
import {
  materializeCharacter,
  materializeModifier,
  planLegacyCharacterImport,
} from "../../../src/application/import/legacy-character-import-planner.js";
import type { NormalizedLegacyCampaign } from "../../../src/application/import/legacy-campaign-normalizer.js";
import type { NormalizedLegacyCharacter } from "../../../src/application/import/legacy-character-normalizer.js";
import { LEGACY_TRACKER_PROFILE } from "../../../src/application/import/legacy-tracker-stage.js";

const NOW = new Date("2026-08-29T10:00:00.000Z");

describe("legacy character import planner", () => {
  it("plans a complete character aggregate for a clean campaign", () => {
    const plan = planLegacyCharacterImport(campaign(), emptyState(), sequenceIds());

    expect(plan.blocked).toBe(false);
    expect(plan.characters).toHaveLength(1);
    expect(plan.attributes).toHaveLength(6);
    expect(plan.permanentModifiers).toHaveLength(1);
    expect(plan.characterIdsByCanonicalName.get("LAEZEL")).toBe("id-1");
    expect(plan.entries.filter((entry) => entry.category === "inserted")).toHaveLength(8);
    expect(materializeCharacter(plan.characters[0]!, NOW)).toMatchObject({
      id: "id-1",
      canonicalName: "LAEZEL",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(materializeModifier(plan.permanentModifiers[0]!, NOW)).toMatchObject({
      id: "id-2",
      characterId: "id-1",
      sourceNamePl: "Mikstura Wiecznego Wigoru",
      createdAt: NOW,
    });
  });

  it("turns an exact second import into matches with no insert operations", () => {
    const first = planLegacyCharacterImport(campaign(), emptyState(), sequenceIds());
    const character = materializeCharacter(first.characters[0]!, NOW);
    const modifier = materializeModifier(first.permanentModifiers[0]!, NOW);
    const state: CampaignImportState = {
      ...emptyState(),
      characters: [character],
      characterAttributes: first.attributes,
      permanentModifiers: [modifier],
    };

    const second = planLegacyCharacterImport(campaign(), state, sequenceIds());
    expect(second.blocked).toBe(false);
    expect(second.characters).toEqual([]);
    expect(second.attributes).toEqual([]);
    expect(second.permanentModifiers).toEqual([]);
    expect(second.entries.filter((entry) => entry.category === "matched")).toHaveLength(8);
  });

  it("blocks an incompatible existing non-null character fact without planning dependants", () => {
    const existing = materializeCharacter(
      planLegacyCharacterImport(campaign(), emptyState(), sequenceIds()).characters[0]!,
      NOW,
    );
    const state = { ...emptyState(), characters: [{ ...existing, level: 8 }] };

    const plan = planLegacyCharacterImport(campaign(), state, sequenceIds());
    expect(plan.blocked).toBe(true);
    expect(plan.characters).toEqual([]);
    expect(plan.attributes).toEqual([]);
    expect(plan.permanentModifiers).toEqual([]);
    expect(plan.entries).toEqual([
      expect.objectContaining({
        category: "conflicts",
        reasonCode: "CHARACTER_FACT_CONFLICT",
        canonicalEntityId: "id-1",
        blocking: true,
      }),
    ]);
  });
});

function campaign(): NormalizedLegacyCampaign {
  return {
    workbookProfile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "f".repeat(64),
    characters: [characterFact()],
    items: [],
    abilities: [],
    spells: [],
    illithidPowers: [],
    issues: [],
    skipped: [],
  };
}

function characterFact(): NormalizedLegacyCharacter {
  return {
    sourceKey: "character:LAEZEL",
    source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Postacie", row: 2, field: null },
    canonicalName: "LAEZEL",
    displayNamePl: "Lae'zel",
    racePl: "Githyanki",
    classPl: "Wojownik",
    subclassPl: "Mistrz Bitew",
    pactVariantPl: null,
    level: 9,
    roleSummary: "Frontliner",
    activeParty: true,
    notes: "Stałe +2 SIŁ z Mikstury Wiecznego Wigoru; wynikowa SIŁ = 22.",
    attributes: { STR: 20, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 8 },
    permanentStrengthModifier: {
      modifier: 2,
      sourceNamePl: "Mikstura Wiecznego Wigoru",
      provenanceType: "IMPORT",
      permanent: true,
      active: true,
      notes: "Stałe +2 SIŁ z Mikstury Wiecznego Wigoru; wynikowa SIŁ = 22.",
      source: {
        profile: LEGACY_TRACKER_PROFILE,
        sheet: "Postacie",
        row: 2,
        field: "Stała premia SIŁ",
      },
    },
    effectiveStrength: 22,
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

function sequenceIds() {
  let value = 0;
  return { nextId: () => `id-${++value}` };
}
