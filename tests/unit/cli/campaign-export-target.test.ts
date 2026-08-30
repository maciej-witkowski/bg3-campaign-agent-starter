import { linkSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { assertSafeCampaignExportTarget } from "../../../src/cli/campaign-export-target.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-export-target-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("assertSafeCampaignExportTarget", () => {
  it("rejects the campaign database and relevant SQLite companion paths", () => {
    const directory = temporaryDirectory();
    const databasePath = join(directory, "campaign.sqlite");
    writeFileSync(databasePath, "database");

    for (const outputPath of [
      databasePath,
      `${databasePath}-wal`,
      `${databasePath}-shm`,
      `${databasePath}-journal`,
    ]) {
      expect(() => assertSafeCampaignExportTarget(databasePath, outputPath)).toThrowError(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
    }
  });

  it("rejects an existing filesystem alias of the campaign database", () => {
    const directory = temporaryDirectory();
    const databasePath = join(directory, "campaign.sqlite");
    const aliasPath = join(directory, "alias.sqlite");
    writeFileSync(databasePath, "database");
    linkSync(databasePath, aliasPath);

    expect(() => assertSafeCampaignExportTarget(databasePath, aliasPath)).toThrowError(
      "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
    );
  });

  it("allows a distinct explicit export target", () => {
    const directory = temporaryDirectory();
    const databasePath = join(directory, "campaign.sqlite");
    writeFileSync(databasePath, "database");

    expect(() =>
      assertSafeCampaignExportTarget(databasePath, join(directory, "campaign.json")),
    ).not.toThrow();
  });
});
