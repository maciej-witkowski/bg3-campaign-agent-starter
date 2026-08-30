import { describe, expect, it } from "vitest";

import {
  createNormalizationReconciliation,
  createNormalizationReport,
  normalizeLegacyCampaign,
  type NormalizedLegacyCampaign,
} from "../../../src/application/import/legacy-campaign-normalizer.js";
import { parseImportReconciliation } from "../../../src/application/import/import-contracts.js";
import { CampaignDomainError } from "../../../src/domain/mutations/campaign-mutation.js";
import {
  LEGACY_CHANGE_LOG_HEADERS,
  LEGACY_CHARACTER_HEADERS,
  LEGACY_ITEM_HEADERS,
  LEGACY_TRACKER_PROFILE,
  type LegacyChangeLogRow,
  type LegacyCharacterRow,
  type LegacyItemRow,
  type LegacyScalar,
  type LegacyTrackerStage,
} from "../../../src/application/import/legacy-tracker-stage.js";

describe("legacy campaign normalization aggregate", () => {
  it("reports instruction sheets and historical log rows as explicit skips", () => {
    const campaign = normalizeLegacyCampaign(stage([legacyLogRow()]));
    const report = createNormalizationReport(campaign);

    expect(report).toMatchObject({
      format: "BG3_IMPORT_REPORT",
      version: 1,
      workbookProfile: LEGACY_TRACKER_PROFILE,
      workbookSha256: "d".repeat(64),
    });
    expect(report.entries.map((entry) => entry.reasonCode)).toEqual([
      "LEGACY_CHANGE_LOG_NOT_AUDIT_HISTORY",
      "LEGACY_DASHBOARD_DERIVED",
      "LEGACY_PROMPT_NON_EXECUTABLE",
      "LEGACY_INSTRUCTIONS_NON_EXECUTABLE",
    ]);
    expect(report.entries.every((entry) => entry.category === "skipped")).toBe(true);
  });

  it("creates a strict digest-bound reconciliation document from normalization issues", () => {
    const campaign: NormalizedLegacyCampaign = {
      workbookProfile: LEGACY_TRACKER_PROFILE,
      workbookSha256: "e".repeat(64),
      characters: [],
      items: [],
      abilities: [],
      spells: [],
      illithidPowers: [],
      skipped: [],
      issues: [
        {
          issueId: "issue:1234567890abcdef12345678",
          category: "ambiguous",
          entityKind: "spell",
          source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Czary", row: 2, field: "Źródło" },
          sourceKey: "spell:test|1",
          reasonCode: "SPELL_SOURCE_UNKNOWN",
          messagePl: "Nieznane źródło.",
          blocking: false,
          canonicalEntityId: null,
          relatedIds: [],
          rawFacts: { value: "Nieznane" },
        },
      ],
    };

    const reconciliation = createNormalizationReconciliation(campaign);
    expect(parseImportReconciliation(reconciliation)).toEqual(reconciliation);
    expect(reconciliation).toMatchObject({
      format: "BG3_IMPORT_RECONCILIATION",
      version: 1,
      workbookSha256: "e".repeat(64),
      issues: [
        {
          issueId: "issue:1234567890abcdef12345678",
          category: "ambiguous",
          candidateCanonicalIds: [],
          rawFacts: { value: "Nieznane" },
          resolution: null,
        },
      ],
    });
  });

  it("applies canonical-value and verified-alias decisions to the staged source", () => {
    const source = stage([], [itemRow({ Status: "NIEZNANY", "Alias EN": "Astral Sword" })]);
    const initial = normalizeLegacyCampaign(source);
    const document = createNormalizationReconciliation(initial);
    const reconciled = {
      ...document,
      issues: document.issues.map((issue) => ({
        ...issue,
        resolution:
          issue.reasonCode === "ITEM_STATUS_UNKNOWN"
            ? ({ action: "provide_canonical_value", value: "SKRZYNIA" } as const)
            : issue.reasonCode === "ENGLISH_ALIAS_UNATTESTED"
              ? ({ action: "attest_verified_alias", aliasEn: "Astral Sword" } as const)
              : null,
      })),
    };

    const campaign = normalizeLegacyCampaign(source, reconciled);
    expect(campaign.issues).toEqual([]);
    expect(campaign.items).toHaveLength(1);
    expect(campaign.items[0]).toMatchObject({
      nameEn: "Astral Sword",
      unresolvedAliasEn: null,
      placement: { status: "CHEST" },
    });
    expect(campaign.appliedReconciliationIssues).toHaveLength(2);
    expect(createNormalizationReport(campaign).entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ reasonCode: "RECONCILIATION_APPLIED" })]),
    );
  });

  it("requires source correction for duplicate character display names", () => {
    const source = stage(
      [],
      [],
      [
        characterRow({ ID: "FIRST", Postać: "Wspólna nazwa" }, 2),
        characterRow({ ID: "SECOND", Postać: "Wspólna nazwa" }, 3),
      ],
    );
    const initial = normalizeLegacyCampaign(source);
    const document = createNormalizationReconciliation(initial);
    const issue = document.issues.find(
      (value) => value.reasonCode === "DUPLICATE_CHARACTER_DISPLAY_NAME",
    )!;

    for (const resolution of [
      { action: "provide_canonical_value" as const, value: "Druga postać" },
      { action: "skip" as const },
    ]) {
      const reconciliation = {
        ...document,
        issues: document.issues.map((value) =>
          value.issueId === issue.issueId ? { ...value, resolution } : value,
        ),
      };

      expect(() => normalizeLegacyCampaign(source, reconciliation)).toThrow(CampaignDomainError);
      expect(() => normalizeLegacyCampaign(source, reconciliation)).toThrow(
        "Duplikat nazwy postaci wymaga poprawienia źródłowego trackera",
      );
    }
  });
});

function stage(
  legacyChangeLog: readonly LegacyChangeLogRow[],
  items: readonly LegacyItemRow[] = [],
  characters: readonly LegacyCharacterRow[] = [],
): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "d".repeat(64),
    characters,
    equipment: [],
    items,
    abilities: [],
    spells: [],
    illithidPowers: [],
    legacyChangeLog,
  };
}

function characterRow(
  overrides: Partial<Record<(typeof LEGACY_CHARACTER_HEADERS)[number], LegacyScalar>> = {},
  row = 2,
): LegacyCharacterRow {
  const values: Record<(typeof LEGACY_CHARACTER_HEADERS)[number], LegacyScalar> = {
    ID: "HERO",
    Postać: "Bohater",
    Aktywna: "TAK",
    Poziom: 9,
    Rasa: null,
    Klasa: "Wojownik",
    Podklasa: null,
    "Pakt / wariant": null,
    Rola: "Frontliner",
    "SIŁ bazowa": 18,
    "Stała premia SIŁ": 0,
    "SIŁ aktualna": 18,
    ZR: 14,
    KON: 16,
    INT: 8,
    MĄD: 10,
    CHA: 8,
    Uwagi: null,
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

function itemRow(
  overrides: Partial<Record<(typeof LEGACY_ITEM_HEADERS)[number], LegacyScalar>> = {},
): LegacyItemRow {
  const values: Record<(typeof LEGACY_ITEM_HEADERS)[number], LegacyScalar> = {
    "Nazwa PL": "Miecz Astralny",
    "Alias EN": null,
    Kategoria: "Broń",
    Rzadkość: null,
    Status: "SKRZYNIA",
    "Lokalizacja / właściciel": "Skrzynia podróżna",
    Slot: null,
    "Efekt / mechanika": null,
    "Weryfikacja efektu": "POTWIERDZONE W GRZE",
    "Tagi synergii": null,
    Uwagi: null,
    ...overrides,
  };
  return {
    sheet: "Przedmioty",
    row: 2,
    cells: Object.fromEntries(
      LEGACY_ITEM_HEADERS.map((header, index) => [
        header,
        { value: values[header], formula: null, column: index + 1 },
      ]),
    ) as unknown as LegacyItemRow["cells"],
  };
}

function legacyLogRow(): LegacyChangeLogRow {
  return {
    sheet: "Dziennik zmian",
    row: 2,
    cells: Object.fromEntries(
      LEGACY_CHANGE_LOG_HEADERS.map((header, index) => [
        header,
        { value: header === "Status" ? "Historyczny" : null, formula: null, column: index + 1 },
      ]),
    ) as unknown as LegacyChangeLogRow["cells"],
  };
}
