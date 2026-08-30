import { describe, expect, it } from "vitest";

import {
  serializeImportReconciliation,
  serializeImportReport,
} from "../../../src/application/import/import-artifacts.js";
import {
  IMPORT_RECONCILIATION_FORMAT,
  IMPORT_RECONCILIATION_VERSION,
  IMPORT_REPORT_FORMAT,
  IMPORT_REPORT_VERSION,
} from "../../../src/application/import/import-contracts.js";

const digest = "a".repeat(64);

describe("import artifacts", () => {
  it("serializes a strictly validated report deterministically", () => {
    const report = {
      format: IMPORT_REPORT_FORMAT,
      version: IMPORT_REPORT_VERSION,
      workbookProfile: "LEGACY",
      workbookSha256: digest,
      entries: [],
    };
    expect(serializeImportReport(report)).toBe(serializeImportReport(report));
    expect(() => serializeImportReport({ ...report, arbitrarySql: "drop table" })).toThrow();
  });

  it("serializes only bounded reconciliation actions", () => {
    const reconciliation = {
      format: IMPORT_RECONCILIATION_FORMAT,
      version: IMPORT_RECONCILIATION_VERSION,
      workbookProfile: "LEGACY",
      workbookSha256: digest,
      issues: [],
    };
    expect(JSON.parse(serializeImportReconciliation(reconciliation))).toEqual(reconciliation);
  });
});
