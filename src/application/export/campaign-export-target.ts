import { realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";

import { ArtifactWriteError } from "./atomic-artifact-writer.js";

const SQLITE_COMPANION_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;

export interface CampaignExportTargetPolicy {
  assertSafe(targetPath: string): void;
}

export function assertSafeCampaignExportTarget(databasePath: string, outputPath: string): void {
  createCampaignExportTargetPolicy(databasePath).assertSafe(outputPath);
}

export function createCampaignExportTargetPolicy(databasePath: string): CampaignExportTargetPolicy {
  const source = resolve(databasePath);
  const sourceCanonical = canonicalPath(source);
  const protectedPaths = new Set<string>();
  const protectedIdentities = new Set<string>();

  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    for (const protectedPath of [`${source}${suffix}`, `${sourceCanonical}${suffix}`]) {
      protectedPaths.add(protectedPath);
      const identity = existingFileIdentity(protectedPath);
      if (identity !== null) protectedIdentities.add(identity);
    }
  }

  return {
    assertSafe: (outputPath) => {
      const target = resolve(outputPath);
      const targetCanonical = canonicalPath(target);
      if (isProtectedExistingFile(target, protectedIdentities)) {
        throw new ArtifactWriteError(
          "Plik eksportu nie może zastępować bazy kampanii ani jej plików SQLite.",
        );
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
    },
  };
}

function isProtectedExistingFile(
  filename: string,
  protectedIdentities: ReadonlySet<string>,
): boolean {
  const identity = existingFileIdentity(filename);
  return identity !== null && protectedIdentities.has(identity);
}

function existingFileIdentity(filename: string): string | null {
  try {
    const stat = statSync(filename, { bigint: true });
    return `${stat.dev}:${stat.ino}`;
  } catch {
    return null;
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
  const leftIdentity = existingFileIdentity(left);
  return leftIdentity !== null && leftIdentity === existingFileIdentity(right);
}
