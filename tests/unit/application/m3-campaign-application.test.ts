import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { afterEach, describe, expect, it } from "vitest";

import { openM3CampaignApplication } from "../../../src/composition/m3-campaign-application.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { seedM3CampaignFixture } from "../fixtures/m3-campaign-fixture.js";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-m3-application-"));
  temporaryDirectories.push(directory);
  return directory;
}

function sha256(filename: string): string {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("openM3CampaignApplication", () => {
  it("exposes only inspection, validation, export and close over an unchanged database", async () => {
    const directory = createTemporaryDirectory();
    const filename = join(directory, "campaign.sqlite");
    const target = join(directory, "campaign.json");
    const writable = openMigratedSqliteConnection({ filename });
    seedM3CampaignFixture(writable.database);
    writable.close();
    const before = sha256(filename);
    const application = openM3CampaignApplication({
      filename,
      clock: { now: () => new Date("2026-08-30T12:00:00.000Z") },
    });

    try {
      expect(Object.keys(application).sort()).toEqual([
        "campaignExport",
        "close",
        "inspection",
        "validation",
      ]);
      expect(application.inspection.getParty().characters).toHaveLength(2);
      expect(application.validation.validate()).toEqual({ valid: true, violations: [] });
      await expect(
        application.campaignExport.writeJson(filename, { overwrite: true }),
      ).rejects.toThrowError(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
      await expect(
        application.campaignExport.writeXlsx(`${filename}-shm`, { overwrite: true }),
      ).rejects.toThrowError(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
      const exported = await application.campaignExport.writeJson(target);
      expect(exported.state.characters).toHaveLength(5);
    } finally {
      application.close();
    }

    expect(sha256(filename)).toBe(before);
    expect(JSON.parse(readFileSync(target, "utf8"))).toMatchObject({
      format: "BG3_CAMPAIGN_EXPORT",
      version: 1,
    });
  });

  it("anchors a relative protected database path when the application opens", async () => {
    const directory = createTemporaryDirectory();
    const databaseDirectory = join(directory, "database");
    const changedDirectory = join(directory, "changed");
    mkdirSync(databaseDirectory);
    mkdirSync(changedDirectory);
    const filename = join(databaseDirectory, "campaign.sqlite");
    const writable = openMigratedSqliteConnection({ filename });
    seedM3CampaignFixture(writable.database);
    writable.close();
    const before = sha256(filename);
    const previousDirectory = process.cwd();
    let application: ReturnType<typeof openM3CampaignApplication> | undefined;

    try {
      process.chdir(directory);
      application = openM3CampaignApplication({
        filename: join("database", "campaign.sqlite"),
      });
      process.chdir(changedDirectory);

      await expect(
        application.campaignExport.writeJson(filename, { overwrite: true }),
      ).rejects.toThrowError(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
    } finally {
      application?.close();
      process.chdir(previousDirectory);
    }

    expect(sha256(filename)).toBe(before);
  });
});
