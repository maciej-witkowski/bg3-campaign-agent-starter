import { describe, expect, it } from "vitest";

import {
  IMPORT_RECONCILIATION_FORMAT,
  IMPORT_RECONCILIATION_VERSION,
  parseImportReconciliation,
} from "../../../src/application/import/import-contracts.js";

const digest = "a".repeat(64);

describe("import reconciliation contract", () => {
  it("accepts a strict digest-bound resolution selecting a listed candidate", () => {
    const value = {
      format: IMPORT_RECONCILIATION_FORMAT,
      version: IMPORT_RECONCILIATION_VERSION,
      workbookProfile: "BG3_TRACKER_LEGACY_V0",
      workbookSha256: digest,
      issues: [
        {
          issueId: "item:Przedmioty:2",
          entityKind: "item_definition",
          source: {
            profile: "BG3_TRACKER_LEGACY_V0",
            sheet: "Przedmioty",
            row: 2,
            field: "Nazwa PL",
          },
          category: "ambiguous",
          reasonCode: "MULTIPLE_CANDIDATES",
          candidateCanonicalIds: ["item-1", "item-2"],
          rawFacts: { namePl: "Pierścień Żaru", rarityPl: null },
          resolution: { action: "select_existing", canonicalEntityId: "item-2" },
        },
      ],
    };

    expect(parseImportReconciliation(value)).toEqual(value);
  });

  it("rejects unknown fields, duplicate issues and candidate IDs outside the issue", () => {
    const baseIssue = {
      issueId: "spell:Czary:2",
      entityKind: "spell",
      source: {
        profile: "BG3_TRACKER_LEGACY_V0",
        sheet: "Czary",
        row: 2,
        field: "Czar",
      },
      category: "ambiguous",
      reasonCode: "MULTIPLE_CANDIDATES",
      candidateCanonicalIds: ["spell-1"],
      rawFacts: { namePl: "Zamęt" },
      resolution: { action: "select_existing", canonicalEntityId: "spell-missing" },
    } as const;

    expect(() =>
      parseImportReconciliation({
        format: IMPORT_RECONCILIATION_FORMAT,
        version: IMPORT_RECONCILIATION_VERSION,
        workbookProfile: "BG3_TRACKER_LEGACY_V0",
        workbookSha256: digest,
        unexpected: true,
        issues: [baseIssue, baseIssue],
      }),
    ).toThrow();
  });

  it("rejects malformed digests and permissive numeric coercion", () => {
    expect(() =>
      parseImportReconciliation({
        format: IMPORT_RECONCILIATION_FORMAT,
        version: IMPORT_RECONCILIATION_VERSION,
        workbookProfile: "BG3_TRACKER_LEGACY_V0",
        workbookSha256: "not-a-digest",
        issues: [],
      }),
    ).toThrow();
  });
});
