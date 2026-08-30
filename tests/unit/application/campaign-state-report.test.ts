import { describe, expect, it } from "vitest";

import { createCampaignExport } from "../../../src/application/export/campaign-export.js";
import { renderCampaignStateReport } from "../../../src/application/import/campaign-state-report.js";
import {
  IMPORT_REPORT_FORMAT,
  IMPORT_REPORT_VERSION,
} from "../../../src/application/import/import-contracts.js";
import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  SNAPSHOT_COLLECTIONS,
  serializeCampaignSnapshot,
} from "../../../src/domain/snapshots/campaign-snapshot.js";

describe("campaign state report", () => {
  it("shows integrity, idempotency and unresolved import counts", () => {
    const campaignExport = createCampaignExport(
      serializeCampaignSnapshot({
        format: CAMPAIGN_SNAPSHOT_FORMAT,
        version: CAMPAIGN_SNAPSHOT_VERSION,
        schemaVersion: 4,
        capturedAt: "2026-08-29T12:00:00.000Z",
        state: Object.fromEntries(SNAPSHOT_COLLECTIONS.map((name) => [name, []])),
      }),
    );
    const markdown = renderCampaignStateReport(
      campaignExport,
      {
        format: IMPORT_REPORT_FORMAT,
        version: IMPORT_REPORT_VERSION,
        workbookProfile: "LEGACY",
        workbookSha256: "a".repeat(64),
        entries: [],
      },
      {
        databasePath: "campaign.sqlite3",
        firstImportChanged: true,
        secondImportChanged: false,
        auditEventCount: 1,
        integrityCheck: "ok",
        foreignKeyViolationCount: 0,
      },
    );

    expect(markdown).toContain("Pierwszy import zmienił stan: tak");
    expect(markdown).toContain("Powtórny import zmienił stan: nie");
    expect(markdown).toContain("Brak nierozwiązanych wpisów.");
  });
});
