import { describe, expect, it } from "vitest";

import type { CampaignImportState } from "../../../src/application/import/campaign-import-state.js";
import type { NormalizedLegacyCampaign } from "../../../src/application/import/legacy-campaign-normalizer.js";
import type { LegacyCharacterImportPlan } from "../../../src/application/import/legacy-character-import-planner.js";
import {
  materializeAbility,
  materializeIllithidPower,
  materializeSpell,
  planLegacyCapabilityImport,
} from "../../../src/application/import/legacy-capability-import-planner.js";
import { LEGACY_TRACKER_PROFILE } from "../../../src/application/import/legacy-tracker-stage.js";

describe("legacy capability import planner", () => {
  it("plans definitions, assignments and an illithid prerequisite for a clean campaign", () => {
    const plan = planLegacyCapabilityImport(campaign(), emptyState(), characterPlan(), ids());
    expect(plan.blocked).toBe(false);
    expect(plan.abilities).toHaveLength(1);
    expect(plan.characterAbilities).toHaveLength(1);
    expect(plan.spells).toHaveLength(1);
    expect(plan.characterSpells).toHaveLength(1);
    expect(plan.illithidPowers).toHaveLength(2);
    expect(plan.characterIllithidPowers).toHaveLength(1);
    expect(plan.illithidPrerequisites).toEqual([{ powerId: "id-4", prerequisitePowerId: "id-3" }]);
    expect(materializeAbility(plan.abilities[0]!)).toMatchObject({ id: "id-1", type: "FEAT" });
    expect(materializeSpell(plan.spells[0]!)).toMatchObject({ id: "id-2", level: 1 });
    expect(materializeIllithidPower(plan.illithidPowers[1]!)).toMatchObject({
      id: "id-4",
      notes: "Status legacy: ZABLOKOWANA\nŚcieżka / wymóg: Za Tunel Mocy",
    });
  });

  it("makes an exact second plan a no-op", () => {
    const first = planLegacyCapabilityImport(campaign(), emptyState(), characterPlan(), ids());
    const state: CampaignImportState = {
      ...emptyState(),
      abilities: first.abilities.map(materializeAbility),
      characterAbilities: first.characterAbilities,
      spells: first.spells.map(materializeSpell),
      characterSpells: first.characterSpells,
      illithidPowers: first.illithidPowers.map(materializeIllithidPower),
      illithidPowerPrerequisites: first.illithidPrerequisites,
      characterIllithidPowers: first.characterIllithidPowers,
    };
    const second = planLegacyCapabilityImport(campaign(), state, characterPlan(), ids());
    expect(second.blocked).toBe(false);
    expect(second.abilities).toEqual([]);
    expect(second.characterAbilities).toEqual([]);
    expect(second.spells).toEqual([]);
    expect(second.characterSpells).toEqual([]);
    expect(second.illithidPowers).toEqual([]);
    expect(second.illithidPrerequisites).toEqual([]);
    expect(second.characterIllithidPowers).toEqual([]);
    expect(second.entries.every((value) => value.category === "matched")).toBe(true);
  });

  it("blocks an incompatible existing definition", () => {
    const first = planLegacyCapabilityImport(campaign(), emptyState(), characterPlan(), ids());
    const existing = {
      ...materializeSpell(first.spells[0]!),
      verificationStatus: "VERIFIED" as const,
    };
    const plan = planLegacyCapabilityImport(
      campaign(),
      { ...emptyState(), spells: [existing] },
      characterPlan(),
      ids(),
    );
    expect(plan.blocked).toBe(true);
    expect(plan.entries).toContainEqual(
      expect.objectContaining({
        entityKind: "spell",
        category: "conflicts",
        reasonCode: "CAPABILITY_DEFINITION_FACT_CONFLICT",
      }),
    );
  });

  it("reports conflicting assignments within the pending plan before persistence", () => {
    const source = campaign();
    const spell = source.spells[0]!;
    const conflicting: NormalizedLegacyCampaign = {
      ...source,
      spells: [
        {
          ...spell,
          assignments: [
            spell.assignments[0]!,
            {
              ...spell.assignments[0]!,
              prepared: true,
              notes: "inna wersja",
              location: { ...spell.assignments[0]!.location, row: 3 },
            },
          ],
        },
      ],
    };

    const plan = planLegacyCapabilityImport(conflicting, emptyState(), characterPlan(), ids());
    expect(plan.blocked).toBe(true);
    expect(plan.characterSpells).toHaveLength(1);
    expect(plan.entries).toContainEqual(
      expect.objectContaining({
        entityKind: "character_spell",
        category: "conflicts",
        reasonCode: "CAPABILITY_ASSIGNMENT_FACT_CONFLICT",
        source: expect.objectContaining({ sheet: "Czary", row: 3 }),
      }),
    );
  });

  it("matches one prerequisite relation without conflicting with another relation", () => {
    const source = campaign();
    const first = planLegacyCapabilityImport(source, emptyState(), characterPlan(), ids());
    const exact = first.illithidPrerequisites[0]!;
    const state: CampaignImportState = {
      ...emptyState(),
      abilities: first.abilities.map(materializeAbility),
      characterAbilities: first.characterAbilities,
      spells: first.spells.map(materializeSpell),
      characterSpells: first.characterSpells,
      illithidPowers: first.illithidPowers.map(materializeIllithidPower),
      illithidPowerPrerequisites: [
        exact,
        { powerId: exact.powerId, prerequisitePowerId: "another-prerequisite" },
      ],
      characterIllithidPowers: first.characterIllithidPowers,
    };

    const plan = planLegacyCapabilityImport(source, state, characterPlan(), ids());
    expect(plan.blocked).toBe(false);
    expect(plan.illithidPrerequisites).toEqual([]);
    expect(plan.entries).toContainEqual(
      expect.objectContaining({
        entityKind: "illithid_prerequisite",
        category: "matched",
        reasonCode: "CAPABILITY_ASSIGNMENT_EXACT_MATCH",
      }),
    );
  });

  it("keeps distinct source rows for multiple conflicts of one assignment identity", () => {
    const source = campaign();
    const spell = source.spells[0]!;
    const withTwoRows: NormalizedLegacyCampaign = {
      ...source,
      spells: [
        {
          ...spell,
          assignments: [
            spell.assignments[0]!,
            {
              ...spell.assignments[0]!,
              prepared: true,
              notes: "drugi wiersz",
              location: { ...spell.assignments[0]!.location, row: 3 },
            },
          ],
        },
      ],
    };
    const definitionPlan = planLegacyCapabilityImport(source, emptyState(), characterPlan(), ids());
    const definition = materializeSpell(definitionPlan.spells[0]!);
    const state: CampaignImportState = {
      ...emptyState(),
      spells: [definition],
      characterSpells: [
        {
          characterId: "character-1",
          spellId: definition.id,
          source: "INVOCATION",
          known: true,
          prepared: true,
          alwaysPrepared: false,
          notes: "stan bazy",
        },
      ],
    };

    const plan = planLegacyCapabilityImport(withTwoRows, state, characterPlan(), ids());
    expect(
      plan.entries
        .filter((entry) => entry.reasonCode === "CAPABILITY_ASSIGNMENT_FACT_CONFLICT")
        .map((entry) => entry.source.row),
    ).toEqual([2, 3]);
  });
});

function campaign(): NormalizedLegacyCampaign {
  const location = (sheet: string, row: number) => ({
    profile: LEGACY_TRACKER_PROFILE,
    sheet,
    row,
    field: null,
  });
  return {
    workbookProfile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "a".repeat(64),
    characters: [],
    items: [],
    issues: [],
    skipped: [],
    abilities: [
      {
        sourceKey: "ability:atut",
        source: location("Zdolności", 2),
        namePl: "Atut",
        normalizedNamePl: "atut",
        nameEn: null,
        type: "FEAT",
        verificationStatus: "UNKNOWN",
        assignments: [
          {
            characterCanonicalName: "HERO",
            source: "Atut",
            levelAcquired: 4,
            notes: null,
            location: location("Zdolności", 2),
          },
        ],
      },
    ],
    spells: [
      {
        sourceKey: "spell:pancerz|1",
        source: location("Czary", 2),
        namePl: "Pancerz Maga",
        normalizedNamePl: "pancerz maga",
        nameEn: null,
        level: 1,
        verificationStatus: "UNKNOWN",
        assignments: [
          {
            characterCanonicalName: "HERO",
            source: "INVOCATION",
            known: true,
            prepared: false,
            alwaysPrepared: false,
            notes: null,
            location: location("Czary", 2),
          },
        ],
      },
    ],
    illithidPowers: [
      {
        sourceKey: "illithid:tunel",
        source: location("Moce illithidów", 2),
        namePl: "Tunel Mocy",
        normalizedNamePl: "tunel mocy",
        nameEn: null,
        tier: null,
        verificationStatus: "UNKNOWN",
        legacyStatusPl: "WYKUPIONA",
        pathRequirementPl: null,
        prerequisiteNamePl: null,
        assignments: [
          { characterCanonicalName: "HERO", notes: null, location: location("Moce illithidów", 2) },
        ],
      },
      {
        sourceKey: "illithid:przemieszczenie",
        source: location("Moce illithidów", 3),
        namePl: "Przemieszczenie",
        normalizedNamePl: "przemieszczenie",
        nameEn: null,
        tier: null,
        verificationStatus: "UNKNOWN",
        legacyStatusPl: "ZABLOKOWANA",
        pathRequirementPl: "Za Tunel Mocy",
        prerequisiteNamePl: "Tunel Mocy",
        assignments: [],
      },
    ],
  };
}
function characterPlan(): LegacyCharacterImportPlan {
  return {
    characters: [],
    attributes: [],
    permanentModifiers: [],
    characterIdsByCanonicalName: new Map([["HERO", "character-1"]]),
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
