import { describe, expect, it } from "vitest";

import {
  createNormalizationReconciliation,
  createNormalizationReport,
  normalizeLegacyCampaign,
  type NormalizedLegacyCampaign,
} from "../../../src/application/import/legacy-campaign-normalizer.js";
import { parseImportReconciliation } from "../../../src/application/import/import-contracts.js";
import {
  LEGACY_CHANGE_LOG_HEADERS,
  LEGACY_ITEM_HEADERS,
  LEGACY_TRACKER_PROFILE,
  type LegacyChangeLogRow,
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
});

function stage(
  legacyChangeLog: readonly LegacyChangeLogRow[],
  items: readonly LegacyItemRow[] = [],
): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "d".repeat(64),
    characters: [],
    equipment: [],
    items,
    abilities: [],
    spells: [],
    illithidPowers: [],
    legacyChangeLog,
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
