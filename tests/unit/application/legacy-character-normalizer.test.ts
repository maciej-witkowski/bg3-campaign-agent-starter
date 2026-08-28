import { describe, expect, it } from "vitest";

import { normalizeLegacyCharacters } from "../../../src/application/import/legacy-character-normalizer.js";
import {
  LEGACY_CHARACTER_HEADERS,
  LEGACY_TRACKER_PROFILE,
  type LegacyCharacterRow,
  type LegacyScalar,
  type LegacyTrackerStage,
} from "../../../src/application/import/legacy-tracker-stage.js";

describe("legacy character normalization", () => {
  it("preserves Polish facts and separates base Strength from its permanent source", () => {
    const result = normalizeLegacyCharacters(stage([characterRow()]));

    expect(result.issues).toEqual([]);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0]).toMatchObject({
      canonicalName: "LAEZEL",
      displayNamePl: "Lae'zel",
      racePl: "Githyanki",
      classPl: "Wojownik",
      subclassPl: "Mistrz Bitew",
      pactVariantPl: null,
      attributes: { STR: 20, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 8 },
      effectiveStrength: 22,
      permanentStrengthModifier: {
        modifier: 2,
        sourceNamePl: "Mikstura Wiecznego Wigoru",
        provenanceType: "IMPORT",
        permanent: true,
        active: true,
      },
    });
  });

  it("does not coerce numeric text or unknown legacy booleans", () => {
    const row = characterRow({ Aktywna: "BYĆ MOŻE", Poziom: "9" });
    const result = normalizeLegacyCharacters(stage([row]));

    expect(result.characters).toEqual([]);
    expect(
      result.issues.map(({ category, reasonCode, source }) => ({
        category,
        reasonCode,
        field: source.field,
      })),
    ).toEqual([
      { category: "ambiguous", reasonCode: "LEGACY_BOOLEAN_UNKNOWN", field: "Aktywna" },
      { category: "conflicts", reasonCode: "INTEGER_OUT_OF_RANGE", field: "Poziom" },
    ]);
    expect(result.issues[0]?.issueId).toMatch(/^issue:[0-9a-f]{24}$/u);
  });

  it("blocks a derived Strength mismatch and a bonus without exact provenance", () => {
    const result = normalizeLegacyCharacters(
      stage([
        characterRow({
          "SIŁ aktualna": 21,
          Uwagi: "Premia do SIŁ pochodzi prawdopodobnie z mikstury.",
        }),
      ]),
    );

    expect(result.characters).toEqual([]);
    expect(result.issues.map((entry) => entry.reasonCode)).toEqual([
      "EFFECTIVE_STRENGTH_MISMATCH",
      "PERMANENT_STRENGTH_SOURCE_INVALID",
    ]);
    expect(result.issues.every((entry) => entry.blocking)).toBe(true);
  });

  it("rejects duplicate exact character IDs deterministically", () => {
    const result = normalizeLegacyCharacters(
      stage([characterRow(), characterRow({ Postać: "Druga Lae'zel" }, 3)]),
    );

    expect(result.characters).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      reasonCode: "DUPLICATE_CHARACTER_ID",
      sourceKey: "character:LAEZEL",
      source: { sheet: "Postacie", row: 3, field: "ID" },
    });
  });
});

function stage(characters: readonly LegacyCharacterRow[]): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "a".repeat(64),
    characters,
    equipment: [],
    items: [],
    abilities: [],
    spells: [],
    illithidPowers: [],
    legacyChangeLog: [],
  };
}

function characterRow(
  overrides: Partial<Record<(typeof LEGACY_CHARACTER_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacyCharacterRow {
  const values: Record<(typeof LEGACY_CHARACTER_HEADERS)[number], LegacyScalar> = {
    ID: "LAEZEL",
    Postać: "Lae'zel",
    Aktywna: "TAK",
    Poziom: 9,
    Rasa: "Githyanki",
    Klasa: "Wojownik",
    Podklasa: "Mistrz Bitew",
    "Pakt / wariant": null,
    Rola: "Główny frontliner",
    "SIŁ bazowa": 20,
    "Stała premia SIŁ": 2,
    "SIŁ aktualna": 22,
    ZR: 14,
    KON: 16,
    INT: 8,
    MĄD: 10,
    CHA: 8,
    Uwagi: "Stałe +2 SIŁ z Mikstury Wiecznego Wigoru; wynikowa SIŁ = 22.",
    ...overrides,
  };
  return {
    sheet: "Postacie",
    row,
    cells: Object.fromEntries(
      LEGACY_CHARACTER_HEADERS.map((header, index) => [
        header,
        {
          value: values[header],
          formula: header === "SIŁ aktualna" ? "J2+K2" : null,
          column: index + 1,
        },
      ]),
    ) as unknown as LegacyCharacterRow["cells"],
  };
}
