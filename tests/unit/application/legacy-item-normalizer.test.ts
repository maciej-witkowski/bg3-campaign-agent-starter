import { describe, expect, it } from "vitest";

import type { NormalizedLegacyCharacter } from "../../../src/application/import/legacy-character-normalizer.js";
import { normalizeLegacyItems } from "../../../src/application/import/legacy-item-normalizer.js";
import {
  LEGACY_EQUIPMENT_HEADERS,
  LEGACY_ITEM_HEADERS,
  LEGACY_TRACKER_PROFILE,
  type LegacyEquipmentRow,
  type LegacyItemRow,
  type LegacyScalar,
  type LegacyTrackerStage,
} from "../../../src/application/import/legacy-tracker-stage.js";

describe("legacy item and equipment normalization", () => {
  it("builds one definition, effect, placement and equipment fact from two agreeing views", () => {
    const result = normalizeLegacyItems(stage([itemRow()], [equipmentRow()]), [laezel()]);

    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      namePl: "Miecz Astralnej Równiny",
      normalizedNamePl: "miecz astralnej równiny",
      nameEn: null,
      unresolvedAliasEn: null,
      typePl: "Broń",
      slot: "MAIN_HAND",
      rarityPl: null,
      verificationStatus: "VERIFIED",
      verificationSource: "POTWIERDZONE W GRZE",
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
    });
    expect(result.items[0]?.fingerprint).toMatch(/^import-v1:[0-9a-f]{64}$/u);
  });

  it("keeps an unknown effect absent and an unattested English alias unresolved", () => {
    const result = normalizeLegacyItems(
      stage([
        itemRow({
          "Alias EN": "Astral Sword",
          Status: "SKRZYNIA",
          "Lokalizacja / właściciel": "Skrzynia podróżna",
          Slot: null,
          "Efekt / mechanika": null,
          "Weryfikacja efektu": "DO WERYFIKACJI",
        }),
      ]),
      [laezel()],
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      nameEn: null,
      unresolvedAliasEn: "Astral Sword",
      slot: null,
      verificationStatus: "UNVERIFIED",
      effect: null,
      placement: {
        status: "CHEST",
        ownerCharacterCanonicalName: null,
        obtainedLocationPl: "Skrzynia podróżna",
      },
      equipmentSlot: null,
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      category: "ambiguous",
      reasonCode: "ENGLISH_ALIAS_UNATTESTED",
      blocking: false,
    });
  });

  it("normalizes sold inventory as ownerless regardless of its location text", () => {
    const result = normalizeLegacyItems(
      stage([itemRow({ Status: "SPRZEDANY", "Lokalizacja / właściciel": "Kupiec" })]),
      [laezel()],
    );

    expect(result.issues).toEqual([]);
    expect(result.items[0]?.placement).toMatchObject({
      status: "SOLD",
      ownerCharacterCanonicalName: null,
    });
  });

  it("blocks disagreement between equipped item and equipment views", () => {
    const missingView = normalizeLegacyItems(stage([itemRow()]), [laezel()]);
    expect(missingView.items).toEqual([]);
    expect(missingView.issues.map((entry) => entry.reasonCode)).toEqual([
      "EQUIPPED_ITEM_VIEW_MISMATCH",
    ]);

    const orphanView = normalizeLegacyItems(stage([], [equipmentRow()]), [laezel()]);
    expect(orphanView.items).toEqual([]);
    expect(orphanView.issues.map((entry) => entry.reasonCode)).toEqual([
      "EQUIPMENT_ROW_WITHOUT_ITEM",
    ]);
  });

  it("merges exact duplicate source rows but rejects a same-name material collision", () => {
    const exact = normalizeLegacyItems(stage([itemRow(), itemRow({}, 3)], [equipmentRow()]), [
      laezel(),
    ]);
    expect(exact.items).toHaveLength(1);
    expect(exact.issues).toEqual([]);

    const collision = normalizeLegacyItems(
      stage([itemRow(), itemRow({ "Efekt / mechanika": "+2 do ataku" }, 3)], [equipmentRow()]),
      [laezel()],
    );
    expect(collision.items).toHaveLength(1);
    expect(collision.issues.map((entry) => entry.reasonCode)).toEqual(["ITEM_NAME_COLLISION"]);
  });
});

function stage(
  items: readonly LegacyItemRow[],
  equipment: readonly LegacyEquipmentRow[] = [],
): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "b".repeat(64),
    characters: [],
    equipment,
    items,
    abilities: [],
    spells: [],
    illithidPowers: [],
    legacyChangeLog: [],
  };
}

function itemRow(
  overrides: Partial<Record<(typeof LEGACY_ITEM_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacyItemRow {
  const values: Record<(typeof LEGACY_ITEM_HEADERS)[number], LegacyScalar> = {
    "Nazwa PL": "Miecz Astralnej Równiny",
    "Alias EN": null,
    Kategoria: "Broń",
    Rzadkość: null,
    Status: "WYPOSAŻONY",
    "Lokalizacja / właściciel": "Lae'zel",
    Slot: "Broń",
    "Efekt / mechanika": "+1 do ataku",
    "Weryfikacja efektu": "POTWIERDZONE W GRZE",
    "Tagi synergii": "atak",
    Uwagi: null,
    ...overrides,
  };
  return stagedRow("Przedmioty", row, LEGACY_ITEM_HEADERS, values) as LegacyItemRow;
}

function equipmentRow(row = 2): LegacyEquipmentRow {
  const values: Record<(typeof LEGACY_EQUIPMENT_HEADERS)[number], LegacyScalar> = {
    Postać: "Lae'zel",
    Slot: "Broń",
    "Przedmiot PL": "Miecz Astralnej Równiny",
    Status: "WYPOSAŻONY",
    Uwagi: null,
  };
  return stagedRow("Wyposażenie", row, LEGACY_EQUIPMENT_HEADERS, values) as LegacyEquipmentRow;
}

function stagedRow<Header extends string>(
  sheet: string,
  row: number,
  headers: readonly Header[],
  values: Readonly<Record<Header, LegacyScalar>>,
) {
  return {
    sheet,
    row,
    cells: Object.fromEntries(
      headers.map((header, index) => [
        header,
        { value: values[header], formula: null, column: index + 1 },
      ]),
    ),
  };
}

function laezel(): NormalizedLegacyCharacter {
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
    notes: null,
    attributes: { STR: 20, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 8 },
    permanentStrengthModifier: null,
    effectiveStrength: 20,
  };
}
