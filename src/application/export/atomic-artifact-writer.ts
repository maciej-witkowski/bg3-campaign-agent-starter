import { randomUUID } from "node:crypto";
import { link, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export interface ArtifactWriteOptions {
  readonly overwrite?: boolean;
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
  const target = explicitTarget(targetPath);
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
      await rename(temporary, target);
    } else {
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

function explicitTarget(targetPath: string): string {
  if (targetPath.trim() === "" || basename(targetPath) === "." || basename(targetPath) === "..") {
    throw new ArtifactWriteError("Wymagana jest jawna ścieżka pliku docelowego.");
  }
  return resolve(targetPath);
}

function isExistingTarget(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "EEXIST"
  );
}
