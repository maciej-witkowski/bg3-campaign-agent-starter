import type { ArtifactWriteOptions } from "../export/atomic-artifact-writer.js";
import { writeVerifiedArtifact } from "../export/atomic-artifact-writer.js";
import {
  parseImportReconciliation,
  parseImportReport,
  type ImportReconciliation,
  type ImportReport,
} from "./import-contracts.js";

export function serializeImportReport(value: unknown): string {
  return `${JSON.stringify(parseImportReport(value), null, 2)}\n`;
}

export function serializeImportReconciliation(value: unknown): string {
  return `${JSON.stringify(parseImportReconciliation(value), null, 2)}\n`;
}

export async function writeImportReport(
  targetPath: string,
  value: ImportReport,
  options: ArtifactWriteOptions = {},
): Promise<string> {
  return writeJsonArtifact(targetPath, serializeImportReport(value), parseImportReport, options);
}

export async function writeImportReconciliation(
  targetPath: string,
  value: ImportReconciliation,
  options: ArtifactWriteOptions = {},
): Promise<string> {
  return writeJsonArtifact(
    targetPath,
    serializeImportReconciliation(value),
    parseImportReconciliation,
    options,
  );
}

async function writeJsonArtifact(
  targetPath: string,
  payload: string,
  parse: (value: unknown) => unknown,
  options: ArtifactWriteOptions,
): Promise<string> {
  return writeVerifiedArtifact(
    targetPath,
    new TextEncoder().encode(payload),
    (bytes) => {
      parse(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
    },
    options,
  );
}
