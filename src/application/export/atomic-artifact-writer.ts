import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { link, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export interface ArtifactWriteOptions {
  readonly overwrite?: boolean;
}

export interface ArtifactPublicationGuard {
  assertSafe(targetPath: string): void;
}

export interface ResolvedArtifactTarget {
  readonly path: string;
  readonly parentDevice: number;
  readonly parentInode: number;
}

export class ArtifactWriteError extends Error {
  public override readonly name = "ArtifactWriteError";

  public constructor(message: string) {
    super(message);
  }
}

export async function writeVerifiedArtifact(
  targetPath: string,
  bytes: Uint8Array,
  verify: (publishedBytes: Uint8Array) => void | Promise<void>,
  options: ArtifactWriteOptions = {},
): Promise<string> {
  const target = prepareArtifactTarget(targetPath);
  return writeVerifiedArtifactToResolvedTarget(target, bytes, verify, options);
}

export async function writeVerifiedArtifactToResolvedTarget(
  resolvedTarget: ResolvedArtifactTarget,
  bytes: Uint8Array,
  verify: (publishedBytes: Uint8Array) => void | Promise<void>,
  options: ArtifactWriteOptions = {},
  publicationGuard?: ArtifactPublicationGuard,
): Promise<string> {
  const target = resolvedTarget.path;
  assertStableResolvedTarget(resolvedTarget);
  publicationGuard?.assertSafe(target);
  const temporary = resolve(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  let temporaryExists = false;
  try {
    const handle = await open(temporary, "wx");
    temporaryExists = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await verify(new Uint8Array(await readFile(temporary)));
    if (options.overwrite === true) {
      assertStableResolvedTarget(resolvedTarget);
      publicationGuard?.assertSafe(target);
      await rename(temporary, target);
    } else {
      assertStableResolvedTarget(resolvedTarget);
      publicationGuard?.assertSafe(target);
      await link(temporary, target);
      await unlink(temporary);
    }
    temporaryExists = false;
    return target;
  } catch (error: unknown) {
    if (temporaryExists) await unlink(temporary).catch(() => undefined);
    if (isExistingTarget(error)) {
      throw new ArtifactWriteError(`Plik docelowy już istnieje: ${target}.`);
    }
    if (error instanceof ArtifactWriteError) throw error;
    throw new ArtifactWriteError(`Nie udało się bezpiecznie zapisać artefaktu: ${target}.`);
  }
}

export function prepareArtifactTarget(targetPath: string): ResolvedArtifactTarget {
  const path = resolveArtifactTarget(targetPath);
  try {
    const parent = statSync(dirname(path));
    return {
      path,
      parentDevice: parent.dev,
      parentInode: parent.ino,
    };
  } catch {
    throw new ArtifactWriteError(`Nie można zweryfikować katalogu docelowego: ${dirname(path)}.`);
  }
}

export function resolveArtifactTarget(targetPath: string): string {
  if (targetPath.trim() === "" || basename(targetPath) === "." || basename(targetPath) === "..") {
    throw new ArtifactWriteError("Wymagana jest jawna ścieżka pliku docelowego.");
  }
  const target = resolve(targetPath);
  try {
    return join(realpathSync.native(dirname(target)), basename(target));
  } catch {
    return target;
  }
}

function assertStableResolvedTarget(target: ResolvedArtifactTarget): void {
  try {
    const currentPath = resolveArtifactTarget(target.path);
    const parent = statSync(dirname(currentPath));
    if (
      normalizePath(currentPath) !== normalizePath(target.path) ||
      parent.dev !== target.parentDevice ||
      parent.ino !== target.parentInode
    ) {
      throw new ArtifactWriteError(
        `Katalog docelowy zmienił tożsamość podczas zapisu artefaktu: ${dirname(target.path)}.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof ArtifactWriteError) throw error;
    throw new ArtifactWriteError(
      `Katalog docelowy zmienił tożsamość podczas zapisu artefaktu: ${dirname(target.path)}.`,
    );
  }
}

function normalizePath(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function isExistingTarget(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "EEXIST"
  );
}
