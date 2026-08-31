import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { describe, expect, it } from "vitest";

import { createCampaignExport } from "../../../src/application/export/campaign-export.js";
import { CampaignExportService } from "../../../src/application/export/campaign-export-service.js";
import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  SNAPSHOT_COLLECTIONS,
  serializeCampaignSnapshot,
} from "../../../src/domain/snapshots/campaign-snapshot.js";

const capturedAt = "2026-08-31T12:00:00.000Z";

describe("CampaignExportService", () => {
  it("anchors an XLSX target before asynchronous serialization", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-export-service-"));
    const initialDirectory = join(directory, "initial");
    const changedDirectory = join(directory, "changed");
    mkdirSync(initialDirectory);
    mkdirSync(changedDirectory);
    const previousDirectory = process.cwd();
    const checkedTargets: string[] = [];
    let releaseSerialization: ((bytes: Uint8Array) => void) | undefined;
    const service = new CampaignExportService(
      { captureCurrentState: () => emptySnapshot() },
      { now: () => new Date(capturedAt) },
      {
        serialize: () =>
          new Promise((resolve) => {
            releaseSerialization = resolve;
          }),
        deserialize: async () => createCampaignExport(emptySnapshot()),
      },
      { assertSafe: (targetPath) => checkedTargets.push(targetPath) },
    );

    try {
      process.chdir(initialDirectory);
      const write = service.writeXlsx("campaign.xlsx", { overwrite: true });
      expect(releaseSerialization).toBeDefined();
      process.chdir(changedDirectory);
      releaseSerialization!(new TextEncoder().encode("xlsx"));
      await write;

      expect(checkedTargets).toEqual([join(initialDirectory, "campaign.xlsx")]);
      expect(existsSync(join(initialDirectory, "campaign.xlsx"))).toBe(true);
      expect(existsSync(join(changedDirectory, "campaign.xlsx"))).toBe(false);
    } finally {
      process.chdir(previousDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function emptySnapshot(): string {
  return serializeCampaignSnapshot({
    format: CAMPAIGN_SNAPSHOT_FORMAT,
    version: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: 3,
    capturedAt,
    state: Object.fromEntries(SNAPSHOT_COLLECTIONS.map((name) => [name, []])),
  });
}
