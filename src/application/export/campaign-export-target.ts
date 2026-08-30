import { realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";

import { ArtifactWriteError } from "./atomic-artifact-writer.js";

const SQLITE_COMPANION_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;

export function assertSafeCampaignExportTarget(databasePath: string, outputPath: string): void {
  const source = resolve(databasePath);
  const sourceCanonical = canonicalPath(source);
  const target = resolve(outputPath);
  const targetCanonical = canonicalPath(target);
  const protectedPaths = new Set<string>();

  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    protectedPaths.add(`${source}${suffix}`);
    protectedPaths.add(`${sourceCanonical}${suffix}`);
  }

  for (const protectedPath of protectedPaths) {
    if (
      samePath(target, protectedPath) ||
      samePath(targetCanonical, canonicalPath(protectedPath)) ||
      sameExistingFile(target, protectedPath)
    ) {
      throw new ArtifactWriteError(
        "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
      );
    }
  }
}

function canonicalPath(filename: string): string {
  try {
    return realpathSync.native(filename);
  } catch {
    try {
      return join(realpathSync.native(dirname(filename)), basename(filename));
    } catch {
      return resolve(filename);
    }
  }
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) =>
    process.platform === "win32" ? value.toLocaleLowerCase("en-US") : value;
  return normalize(resolve(left)) === normalize(resolve(right));
}

function sameExistingFile(left: string, right: string): boolean {
  try {
    const leftStat = statSync(left, { bigint: true });
    const rightStat = statSync(right, { bigint: true });
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    return false;
  }
}
