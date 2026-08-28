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
  LEGACY_TRACKER_PROFILE,
  type LegacyChangeLogRow,
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
});

function stage(legacyChangeLog: readonly LegacyChangeLogRow[]): LegacyTrackerStage {
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "d".repeat(64),
    characters: [],
    equipment: [],
    items: [],
    abilities: [],
    spells: [],
    illithidPowers: [],
    legacyChangeLog,
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
