import ExcelJS from "exceljs";
import type { CellValue, Workbook as ExcelWorkbook, Worksheet } from "exceljs";

import {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  normalizeCampaignExport,
  type CampaignExportV1,
} from "../../application/export/campaign-export.js";
import {
  SNAPSHOT_COLLECTION_FIELDS,
  SNAPSHOT_COLLECTIONS,
  type SnapshotCollection,
  type SnapshotScalar,
} from "../../domain/snapshots/campaign-snapshot.js";

export const CAMPAIGN_XLSX_FORMAT = "BG3_CAMPAIGN_XLSX" as const;
export const CAMPAIGN_XLSX_VERSION = 1 as const;
export const CAMPAIGN_XLSX_METADATA_SHEET = "Metadane" as const;
const { Workbook } = ExcelJS;

const METADATA_KEYS = [
  "format",
  "version",
  "exportFormat",
  "exportVersion",
  "sourceSnapshotFormat",
  "sourceSnapshotVersion",
  "schemaVersion",
  "exportedAt",
  "stateSha256",
] as const;

export class CampaignExportWorkbookError extends Error {
  public override readonly name = "CampaignExportWorkbookError";
}

export async function serializeCampaignExportWorkbook(value: unknown): Promise<Uint8Array> {
  const campaignExport = normalizeCampaignExport(value);
  const workbook = new Workbook();
  workbook.creator = "BG3 Campaign Agent";
  workbook.created = new Date(campaignExport.exportedAt);
  workbook.modified = new Date(campaignExport.exportedAt);
  addMetadataSheet(workbook, campaignExport);
  for (const collection of SNAPSHOT_COLLECTIONS) {
    addCollectionSheet(workbook, collection, campaignExport);
  }
  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes);
}

export async function deserializeCampaignExportWorkbook(
  bytes: Uint8Array,
): Promise<CampaignExportV1> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
      { ignoreNodes: ["tableParts"] },
    );
  } catch {
    throw new CampaignExportWorkbookError("Nie udało się odczytać eksportu XLSX.");
  }
  const expectedSheets = [CAMPAIGN_XLSX_METADATA_SHEET, ...SNAPSHOT_COLLECTIONS];
  if (
    workbook.worksheets.length !== expectedSheets.length ||
    workbook.worksheets.some((sheet, index) => sheet.name !== expectedSheets[index])
  ) {
    throw new CampaignExportWorkbookError("Zestaw lub kolejność arkuszy eksportu jest niezgodna.");
  }
  const metadata = readMetadata(workbook.getWorksheet(CAMPAIGN_XLSX_METADATA_SHEET));
  if (
    metadata.format !== CAMPAIGN_XLSX_FORMAT ||
    metadata.version !== CAMPAIGN_XLSX_VERSION ||
    metadata.exportFormat !== CAMPAIGN_EXPORT_FORMAT ||
    metadata.exportVersion !== CAMPAIGN_EXPORT_VERSION
  ) {
    throw new CampaignExportWorkbookError("Format lub wersja eksportu XLSX jest nieobsługiwana.");
  }
  const state = Object.fromEntries(
    SNAPSHOT_COLLECTIONS.map((collection) => [
      collection,
      readCollectionSheet(workbook.getWorksheet(collection), collection),
    ]),
  );
  try {
    return normalizeCampaignExport({
      format: metadata.exportFormat,
      version: metadata.exportVersion,
      sourceSnapshotFormat: metadata.sourceSnapshotFormat,
      sourceSnapshotVersion: metadata.sourceSnapshotVersion,
      schemaVersion: metadata.schemaVersion,
      exportedAt: metadata.exportedAt,
      stateSha256: metadata.stateSha256,
      state,
    });
  } catch {
    throw new CampaignExportWorkbookError("Dane eksportu XLSX nie przeszły walidacji.");
  }
}

function addMetadataSheet(workbook: ExcelWorkbook, value: CampaignExportV1): void {
  const sheet = workbook.addWorksheet(CAMPAIGN_XLSX_METADATA_SHEET);
  sheet.addRow(["klucz", "wartość"]);
  const metadata = {
    format: CAMPAIGN_XLSX_FORMAT,
    version: CAMPAIGN_XLSX_VERSION,
    exportFormat: value.format,
    exportVersion: value.version,
    sourceSnapshotFormat: value.sourceSnapshotFormat,
    sourceSnapshotVersion: value.sourceSnapshotVersion,
    schemaVersion: value.schemaVersion,
    exportedAt: value.exportedAt,
    stateSha256: value.stateSha256,
  } as const;
  for (const key of METADATA_KEYS) sheet.addRow([key, metadata[key]]);
  styleHeader(sheet);
  sheet.columns = [{ width: 30 }, { width: 72 }];
}

function addCollectionSheet(
  workbook: ExcelWorkbook,
  collection: SnapshotCollection,
  value: CampaignExportV1,
): void {
  const sheet = workbook.addWorksheet(collection);
  const fields = SNAPSHOT_COLLECTION_FIELDS[collection];
  sheet.addRow(fields);
  for (const record of value.state[collection]) {
    const row = sheet.addRow(fields.map((field) => record[field]));
    for (let index = 0; index < fields.length; index += 1) {
      const scalar = record[fields[index]!];
      if (typeof scalar === "string") row.getCell(index + 1).value = scalar;
    }
  }
  styleHeader(sheet);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns = fields.map((field) => ({ width: Math.max(14, Math.min(48, field.length + 4)) }));
}

function styleHeader(sheet: Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
  });
  sheet.autoFilter = { from: "A1", to: sheet.getRow(1).getCell(sheet.columnCount).address };
}

function readMetadata(
  sheet: Worksheet | undefined,
): Record<(typeof METADATA_KEYS)[number], unknown> {
  if (sheet === undefined || sheet.getRow(1).getCell(1).value !== "klucz") invalidMetadata();
  const result = {} as Record<(typeof METADATA_KEYS)[number], unknown>;
  const seen = new Set<string>();
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const key = scalar(sheet.getRow(rowNumber).getCell(1).value);
    if (typeof key !== "string" || !METADATA_KEYS.includes(key as never) || seen.has(key))
      invalidMetadata();
    seen.add(key);
    result[key as (typeof METADATA_KEYS)[number]] = scalar(
      sheet.getRow(rowNumber).getCell(2).value,
    );
  }
  if (seen.size !== METADATA_KEYS.length) invalidMetadata();
  return result;
}

function readCollectionSheet(
  sheet: Worksheet | undefined,
  collection: SnapshotCollection,
): readonly Readonly<Record<string, SnapshotScalar>>[] {
  if (sheet === undefined) throw new CampaignExportWorkbookError(`Brakuje arkusza ${collection}.`);
  const fields = SNAPSHOT_COLLECTION_FIELDS[collection];
  if (sheet.getRow(1).cellCount !== fields.length) invalidSheet(collection);
  for (let index = 0; index < fields.length; index += 1) {
    if (sheet.getRow(1).getCell(index + 1).value !== fields[index]) invalidSheet(collection);
  }
  const rows: Readonly<Record<string, SnapshotScalar>>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount > fields.length) invalidSheet(collection);
    rows.push(
      Object.fromEntries(
        fields.map((field, index) => [field, scalar(row.getCell(index + 1).value)]),
      ),
    );
  }
  return rows;
}

function scalar(value: CellValue): SnapshotScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  throw new CampaignExportWorkbookError("Eksport XLSX zawiera formułę lub złożoną komórkę.");
}

function invalidMetadata(): never {
  throw new CampaignExportWorkbookError("Arkusz Metadane jest niezgodny z profilem eksportu.");
}

function invalidSheet(collection: SnapshotCollection): never {
  throw new CampaignExportWorkbookError(`Arkusz ${collection} ma niezgodny profil kolumn.`);
}
