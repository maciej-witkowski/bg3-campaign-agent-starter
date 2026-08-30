import { describe, expect, it } from "vitest";

import { normalizeLegacyCapabilities } from "../../../src/application/import/legacy-capability-normalizer.js";
import type { NormalizedLegacyCharacter } from "../../../src/application/import/legacy-character-normalizer.js";
import {
  LEGACY_ABILITY_HEADERS,
  LEGACY_ILLITHID_HEADERS,
  LEGACY_SPELL_HEADERS,
  LEGACY_TRACKER_PROFILE,
  type LegacyAbilityRow,
  type LegacyIllithidRow,
  type LegacyScalar,
  type LegacySpellRow,
  type LegacyTrackerStage,
} from "../../../src/application/import/legacy-tracker-stage.js";

describe("legacy capability normalization", () => {
  it("normalizes ability type, exact source and allow-listed string level", () => {
    const result = normalizeLegacyCapabilities(stage({ abilities: [abilityRow()] }), [hero()]);

    expect(result.issues).toEqual([]);
    expect(result.abilities).toEqual([
      expect.objectContaining({
        namePl: "Wielki Mistrz Broni",
        normalizedNamePl: "wielki mistrz broni",
        type: "FEAT",
        verificationStatus: "UNKNOWN",
        assignments: [
          expect.objectContaining({
            characterCanonicalName: "PC_WARLOCK",
            source: "Atut — poziom 8",
            levelAcquired: 8,
            notes: "Aktywny wybór",
          }),
        ],
      }),
    ]);
  });

  it("normalizes spell source and treats N/D as not prepared without coercion", () => {
    const result = normalizeLegacyCapabilities(stage({ spells: [spellRow()] }), [hero()]);

    expect(result.issues).toEqual([]);
    expect(result.spells[0]).toMatchObject({
      namePl: "Pancerz Maga",
      level: 1,
      verificationStatus: "UNKNOWN",
      assignments: [
        {
          characterCanonicalName: "PC_WARLOCK",
          source: "INVOCATION",
          known: true,
          prepared: false,
          alwaysPrepared: false,
          notes: null,
          location: expect.any(Object),
        },
      ],
    });
  });

  it("distinguishes repeated selections of the same ability by acquisition level", () => {
    const result = normalizeLegacyCapabilities(
      stage({
        abilities: [
          abilityRow({ Nazwa: "Zwiększenie Cech", "Poziom wyboru": "4" }, 2),
          abilityRow({ Nazwa: "Zwiększenie Cech", "Poziom wyboru": "8" }, 3),
        ],
      }),
      [hero()],
    );

    expect(result.issues).toEqual([]);
    expect(result.abilities).toHaveLength(1);
    expect(result.abilities[0]?.assignments.map((value) => value.source)).toEqual([
      "Atut — poziom 4",
      "Atut — poziom 8",
    ]);
  });

  it("creates acquired powers, named definitions and exact prerequisite names while skipping placeholders", () => {
    const result = normalizeLegacyCapabilities(
      stage({
        illithidPowers: [
          illithidRow({ Moc: "Urok", Status: "WYKUPIONA" }, 2),
          illithidRow({ Moc: "Tunel Mocy", Status: "DOSTĘPNA — BRAK KIJANKI" }, 3),
          illithidRow(
            { Moc: "Przemieszczenie", Status: "ZABLOKOWANA", "Ścieżka / wymóg": "Za Tunel Mocy" },
            4,
          ),
          illithidRow({ Moc: "—", Status: "BRAK MOCY" }, 5),
        ],
      }),
      [hero()],
    );

    expect(result.issues).toEqual([]);
    expect(result.illithidPowers).toHaveLength(3);
    expect(
      result.illithidPowers.find((value) => value.namePl === "Urok")?.assignments,
    ).toHaveLength(1);
    expect(
      result.illithidPowers.find((value) => value.namePl === "Tunel Mocy")?.assignments,
    ).toEqual([]);
    expect(result.illithidPowers.find((value) => value.namePl === "Przemieszczenie")).toMatchObject(
      {
        pathRequirementPl: "Za Tunel Mocy",
        prerequisiteNamePl: "Tunel Mocy",
        assignments: [],
      },
    );
    expect(result.skipped).toEqual([
      expect.objectContaining({
        category: "skipped",
        reasonCode: "ILLITHID_PLACEHOLDER_EMPTY",
        blocking: false,
      }),
    ]);
  });

  it("keeps per-character illithid status out of the shared power definition", () => {
    const result = normalizeLegacyCapabilities(
      stage({
        illithidPowers: [
          illithidRow({ Postać: "Główny bohater", Status: "WYKUPIONA" }, 2),
          illithidRow({ Postać: "Towarzysz", Status: "DOSTĘPNA — BRAK KIJANKI" }, 3),
        ],
      }),
      [hero(), companion()],
    );

    expect(result.issues).toEqual([]);
    expect(result.illithidPowers).toEqual([
      expect.objectContaining({
        namePl: "Urok",
        assignments: [
          expect.objectContaining({
            characterCanonicalName: "PC_WARLOCK",
            acquisitionSourcePl: "WYKUPIONA",
          }),
        ],
      }),
    ]);
    expect(result.illithidPowers[0]).not.toHaveProperty("legacyStatusPl");
  });

  it("reports unknown closed tokens and excludes their dependent facts", () => {
    const result = normalizeLegacyCapabilities(
      stage({
        abilities: [abilityRow({ Typ: "Nieznany typ" })],
        spells: [spellRow({ Źródło: "Nieznane źródło" })],
        illithidPowers: [illithidRow({ Status: "MOŻE" })],
      }),
      [hero()],
    );

    expect(result.abilities).toEqual([]);
    expect(result.spells).toEqual([]);
    expect(result.illithidPowers).toEqual([]);
    expect(result.issues.map((entry) => entry.reasonCode)).toEqual([
      "SPELL_SOURCE_UNKNOWN",
      "ILLITHID_STATUS_UNKNOWN",
      "ABILITY_TYPE_UNKNOWN",
    ]);
  });
});

function stage(input: {
  readonly abilities?: readonly LegacyAbilityRow[];
  readonly spells?: readonly LegacySpellRow[];
  readonly illithidPowers?: readonly LegacyIllithidRow[];
}): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "c".repeat(64),
    characters: [],
    equipment: [],
    items: [],
    abilities: input.abilities ?? [],
    spells: input.spells ?? [],
    illithidPowers: input.illithidPowers ?? [],
    legacyChangeLog: [],
  };
}

function abilityRow(
  overrides: Partial<Record<(typeof LEGACY_ABILITY_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacyAbilityRow {
  const values: Record<(typeof LEGACY_ABILITY_HEADERS)[number], LegacyScalar> = {
    Postać: "Główny bohater",
    Typ: "Atut",
    Nazwa: "Wielki Mistrz Broni",
    "Poziom wyboru": "8",
    Status: "Aktywne",
    Uwagi: "Aktywny wybór",
    ...overrides,
  };
  return stagedRow("Zdolności", row, LEGACY_ABILITY_HEADERS, values) as LegacyAbilityRow;
}

function spellRow(
  overrides: Partial<Record<(typeof LEGACY_SPELL_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacySpellRow {
  const values: Record<(typeof LEGACY_SPELL_HEADERS)[number], LegacyScalar> = {
    Postać: "Główny bohater",
    Czar: "Pancerz Maga",
    "Poziom czaru": 1,
    Źródło: "Pancerz Cieni",
    "Znany / dostępny": "TAK",
    Przygotowany: "N/D",
    Uwagi: null,
    ...overrides,
  };
  return stagedRow("Czary", row, LEGACY_SPELL_HEADERS, values) as LegacySpellRow;
}

function illithidRow(
  overrides: Partial<Record<(typeof LEGACY_ILLITHID_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacyIllithidRow {
  const values: Record<(typeof LEGACY_ILLITHID_HEADERS)[number], LegacyScalar> = {
    Postać: "Główny bohater",
    Moc: "Urok",
    Status: "WYKUPIONA",
    "Ścieżka / wymóg": null,
    Uwagi: null,
    ...overrides,
  };
  return stagedRow("Moce illithidów", row, LEGACY_ILLITHID_HEADERS, values) as LegacyIllithidRow;
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

function hero(): NormalizedLegacyCharacter {
  return {
    sourceKey: "character:PC_WARLOCK",
    source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Postacie", row: 2, field: null },
    canonicalName: "PC_WARLOCK",
    displayNamePl: "Główny bohater",
    racePl: null,
    classPl: "Czarownik",
    subclassPl: null,
    pactVariantPl: "Pakt Księgi",
    level: 9,
    roleSummary: "Kontroler",
    activeParty: true,
    notes: null,
    attributes: { STR: 8, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 20 },
    permanentStrengthModifier: null,
    effectiveStrength: 8,
  };
}

function companion(): NormalizedLegacyCharacter {
  return {
    ...hero(),
    sourceKey: "character:COMPANION",
    source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Postacie", row: 3, field: null },
    canonicalName: "COMPANION",
    displayNamePl: "Towarzysz",
  };
}
