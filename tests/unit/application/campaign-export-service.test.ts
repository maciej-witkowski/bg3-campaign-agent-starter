import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { describe, expect, it } from "vitest";

import { createCampaignExport } from "../../../src/application/export/campaign-export.js";
import { CampaignExportService } from "../../../src/application/export/campaign-export-service.js";
import { ArtifactWriteError } from "../../../src/application/export/atomic-artifact-writer.js";
import { createCampaignExportTargetPolicy } from "../../../src/application/export/campaign-export-target.js";
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

      expect(checkedTargets).toEqual(
        Array.from({ length: 3 }, () =>
          join(realpathSync.native(initialDirectory), "campaign.xlsx"),
        ),
      );
      expect(existsSync(join(initialDirectory, "campaign.xlsx"))).toBe(true);
      expect(existsSync(join(changedDirectory, "campaign.xlsx"))).toBe(false);
    } finally {
      process.chdir(previousDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("publishes through the canonical directory captured before serialization", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-export-symlink-"));
    const initialDirectory = join(directory, "initial");
    const redirectedDirectory = join(directory, "redirected");
    const linkedDirectory = join(directory, "linked");
    mkdirSync(initialDirectory);
    mkdirSync(redirectedDirectory);
    symlinkSync(
      initialDirectory,
      linkedDirectory,
      process.platform === "win32" ? "junction" : "dir",
    );
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
    );

    try {
      const write = service.writeXlsx(join(linkedDirectory, "campaign.xlsx"), {
        overwrite: true,
      });
      expect(releaseSerialization).toBeDefined();
      unlinkSync(linkedDirectory);
      symlinkSync(
        redirectedDirectory,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      releaseSerialization!(new TextEncoder().encode("xlsx"));
      await write;

      expect(existsSync(join(initialDirectory, "campaign.xlsx"))).toBe(true);
      expect(existsSync(join(redirectedDirectory, "campaign.xlsx"))).toBe(false);
    } finally {
      if (existsSync(linkedDirectory)) unlinkSync(linkedDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects publication when the checked canonical directory is replaced", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-export-replaced-directory-"));
    const initialDirectory = join(directory, "initial");
    const movedDirectory = join(directory, "moved");
    const databaseDirectory = join(directory, "database");
    const databasePath = join(databaseDirectory, "campaign.sqlite");
    mkdirSync(initialDirectory);
    mkdirSync(databaseDirectory);
    writeFileSync(databasePath, "database");
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
    );

    try {
      const write = service.writeXlsx(join(initialDirectory, "campaign.sqlite"), {
        overwrite: true,
      });
      expect(releaseSerialization).toBeDefined();
      renameSync(initialDirectory, movedDirectory);
      symlinkSync(
        databaseDirectory,
        initialDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      releaseSerialization!(new TextEncoder().encode("xlsx"));

      await expect(write).rejects.toMatchObject({
        name: new ArtifactWriteError("").name,
        message: expect.stringContaining("zmienił tożsamość"),
      });
      expect(readFileSync(databasePath, "utf8")).toBe("database");
      expect(existsSync(join(movedDirectory, "campaign.sqlite"))).toBe(false);
    } finally {
      if (existsSync(initialDirectory)) unlinkSync(initialDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rechecks protected file identity after deferred serialization", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-export-source-after-serialization-"));
    const databasePath = join(directory, "campaign.sqlite");
    const targetPath = join(directory, "campaign.xlsx");
    writeFileSync(databasePath, "database");
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
      createCampaignExportTargetPolicy(databasePath),
    );

    try {
      const write = service.writeXlsx(targetPath, { overwrite: true });
      expect(releaseSerialization).toBeDefined();
      renameSync(databasePath, targetPath);
      releaseSerialization!(new TextEncoder().encode("xlsx"));

      await expect(write).rejects.toThrow(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
      expect(readFileSync(targetPath, "utf8")).toBe("database");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rechecks protected file identity immediately before publication", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-export-source-before-publication-"));
    const databasePath = join(directory, "campaign.sqlite");
    const targetPath = join(directory, "campaign.xlsx");
    writeFileSync(databasePath, "database");
    const service = new CampaignExportService(
      { captureCurrentState: () => emptySnapshot() },
      { now: () => new Date(capturedAt) },
      {
        serialize: async () => new TextEncoder().encode("xlsx"),
        deserialize: async () => {
          renameSync(databasePath, targetPath);
          return createCampaignExport(emptySnapshot());
        },
      },
      createCampaignExportTargetPolicy(databasePath),
    );

    try {
      await expect(service.writeXlsx(targetPath, { overwrite: true })).rejects.toThrow(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
      expect(readFileSync(targetPath, "utf8")).toBe("database");
    } finally {
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
