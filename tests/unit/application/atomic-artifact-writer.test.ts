import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { afterEach, describe, expect, it } from "vitest";

import {
  ArtifactWriteError,
  writeVerifiedArtifact,
} from "../../../src/application/export/atomic-artifact-writer.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("atomic artifact writer", () => {
  it("publishes only an artifact that passes verification", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "campaign.json");

    await expect(
      writeVerifiedArtifact(target, new TextEncoder().encode("bad"), () => {
        throw new Error("invalid");
      }),
    ).rejects.toThrow(ArtifactWriteError);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses an existing target unless overwrite is explicit", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "campaign.json");
    await writeFile(target, "old", "utf8");

    await expect(
      writeVerifiedArtifact(target, new TextEncoder().encode("new"), () => undefined),
    ).rejects.toThrow(/już istnieje/u);
    expect(await readFile(target, "utf8")).toBe("old");

    await writeVerifiedArtifact(target, new TextEncoder().encode("new"), () => undefined, {
      overwrite: true,
    });
    expect(await readFile(target, "utf8")).toBe("new");
  });

  it("rejects publication when verification observes a replaced target directory", async () => {
    const directory = await temporaryDirectory();
    const initialDirectory = join(directory, "initial");
    const movedDirectory = join(directory, "moved");
    const databaseDirectory = join(directory, "database");
    const databasePath = join(databaseDirectory, "campaign.sqlite");
    await mkdir(initialDirectory);
    await mkdir(databaseDirectory);
    await writeFile(databasePath, "database", "utf8");

    await expect(
      writeVerifiedArtifact(
        join(initialDirectory, "campaign.sqlite"),
        new TextEncoder().encode("artifact"),
        async () => {
          await rename(initialDirectory, movedDirectory);
          await symlink(
            databaseDirectory,
            initialDirectory,
            process.platform === "win32" ? "junction" : "dir",
          );
        },
        { overwrite: true },
      ),
    ).rejects.toThrow("zmienił tożsamość");

    expect(await readFile(databasePath, "utf8")).toBe("database");
    await expect(readFile(join(movedDirectory, "campaign.sqlite"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "bg3-export-test-"));
  directories.push(directory);
  return directory;
}
