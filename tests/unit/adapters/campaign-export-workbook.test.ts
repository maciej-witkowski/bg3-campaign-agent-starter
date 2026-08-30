import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_XLSX_METADATA_SHEET,
  deserializeCampaignExportWorkbook,
  serializeCampaignExportWorkbook,
} from "../../../src/adapters/xlsx/campaign-export-workbook.js";
import { createCampaignExport } from "../../../src/application/export/campaign-export.js";
import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  SNAPSHOT_COLLECTIONS,
  serializeCampaignSnapshot,
  type SnapshotCollection,
  type SnapshotRecord,
} from "../../../src/domain/snapshots/campaign-snapshot.js";

function exportWithCampaignText(characterCount = 1) {
  const state = Object.fromEntries(
    SNAPSHOT_COLLECTIONS.map((name) => [name, []]),
  ) as unknown as Record<SnapshotCollection, SnapshotRecord[]>;
  state.characters = Array.from(
    { length: characterCount },
    (_, index) =>
      ({
        id: `character-${index + 1}`,
        canonicalName: "cień",
        displayNamePl: "=NIE FORMUŁA",
        racePl: null,
        classPl: "Kleryczka",
        subclassPl: null,
        level: 7,
        roleSummary: "+wsparcie",
        activeParty: true,
        notes: "@tekst",
        createdAt: "2026-08-29T12:00:00.000Z",
        updatedAt: "2026-08-29T12:00:00.000Z",
      }) as SnapshotRecord,
  );
  return createCampaignExport(
    serializeCampaignSnapshot({
      format: CAMPAIGN_SNAPSHOT_FORMAT,
      version: CAMPAIGN_SNAPSHOT_VERSION,
      schemaVersion: 3,
      capturedAt: "2026-08-29T12:00:00.000Z",
      state,
    }),
  );
}

describe("normalized campaign export workbook", () => {
  it("round-trips all normalized sheets and preserves campaign strings as literal values", async () => {
    const campaignExport = exportWithCampaignText();
    const bytes = await serializeCampaignExportWorkbook(campaignExport);
    const parsed = await deserializeCampaignExportWorkbook(bytes);
    const reopened = new Workbook();
    await reopened.xlsx.load(
      Buffer.from(bytes) as unknown as Parameters<typeof reopened.xlsx.load>[0],
    );

    expect(parsed).toEqual(campaignExport);
    expect(reopened.worksheets.map((sheet) => sheet.name)).toEqual([
      CAMPAIGN_XLSX_METADATA_SHEET,
      ...SNAPSHOT_COLLECTIONS,
    ]);
    expect(reopened.getWorksheet("characters")?.getCell("C2").value).toBe("=NIE FORMUŁA");
    expect(reopened.getWorksheet("characters")?.getCell("C2").formula).toBeUndefined();
    expect(reopened.getWorksheet("characters")?.getCell("H2").value).toBe("+wsparcie");
  });

  it("rejects a workbook with a formula in a normalized sheet", async () => {
    const bytes = await serializeCampaignExportWorkbook(exportWithCampaignText());
    const workbook = new Workbook();
    await workbook.xlsx.load(
      Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    workbook.getWorksheet("characters")!.getCell("C2").value = {
      formula: "1+1",
      result: "2",
    };
    const modified = new Uint8Array(await workbook.xlsx.writeBuffer());

    await expect(deserializeCampaignExportWorkbook(modified)).rejects.toThrow(/formułę/u);
  });

  it("round-trips 1,000 canonical records without applying legacy tracker row limits", async () => {
    const campaignExport = exportWithCampaignText(1_000);
    const bytes = await serializeCampaignExportWorkbook(campaignExport);

    await expect(deserializeCampaignExportWorkbook(bytes)).resolves.toEqual(campaignExport);
  });
});
