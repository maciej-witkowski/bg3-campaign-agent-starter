import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import type { CellValue, Row, Workbook as ExcelWorkbook } from "exceljs";
import { strToU8, unzipSync, zipSync, type Unzipped } from "fflate";

import {
  LEGACY_ABILITY_HEADERS,
  LEGACY_CHANGE_LOG_HEADERS,
  LEGACY_CHARACTER_HEADERS,
  LEGACY_EQUIPMENT_HEADERS,
  LEGACY_ILLITHID_HEADERS,
  LEGACY_ITEM_HEADERS,
  LEGACY_SPELL_HEADERS,
  LEGACY_TRACKER_PROFILE,
  LEGACY_TRACKER_SHEETS,
  type LegacyAbilityRow,
  type LegacyChangeLogRow,
  type LegacyCharacterRow,
  type LegacyEquipmentRow,
  type LegacyIllithidRow,
  type LegacyItemRow,
  type LegacyScalar,
  type LegacySpellRow,
  type LegacyStagedCell,
  type LegacyStagedRow,
  type LegacyTrackerStage,
} from "../../application/import/legacy-tracker-stage.js";

export const DEFAULT_LEGACY_WORKBOOK_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxSheets: 16,
  maxRowsPerSheet: 1_000,
  maxColumnsPerSheet: 64,
  maxCellTextLength: 10_000,
  maxArchiveEntries: 256,
  maxEntryUncompressedBytes: 10 * 1024 * 1024,
  maxArchiveUncompressedBytes: 50 * 1024 * 1024,
} as const;

export interface LegacyWorkbookLimits {
  readonly maxBytes: number;
  readonly maxSheets: number;
  readonly maxRowsPerSheet: number;
  readonly maxColumnsPerSheet: number;
  readonly maxCellTextLength: number;
  readonly maxArchiveEntries: number;
  readonly maxEntryUncompressedBytes: number;
  readonly maxArchiveUncompressedBytes: number;
}

export type LegacyTrackerWorkbookErrorCode =
  | "FILE_TOO_LARGE"
  | "SOURCE_READ_FAILED"
  | "MALFORMED_WORKBOOK"
  | "SHEET_LIMIT_EXCEEDED"
  | "REQUIRED_SHEET_MISSING"
  | "UNEXPECTED_SHEET"
  | "ROW_LIMIT_EXCEEDED"
  | "COLUMN_LIMIT_EXCEEDED"
  | "HEADER_INVALID"
  | "CELL_VALUE_UNSUPPORTED"
  | "CELL_TEXT_TOO_LONG"
  | "UNSAFE_ARCHIVE"
  | "ARCHIVE_LIMIT_EXCEEDED"
  | "LEGACY_NAMESPACE_UNSUPPORTED";

export class LegacyTrackerWorkbookError extends Error {
  public override readonly name = "LegacyTrackerWorkbookError";

  public constructor(
    public readonly code: LegacyTrackerWorkbookErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS_BY_SHEET = new Map<string, readonly string[]>([
  ["Postacie", LEGACY_CHARACTER_HEADERS],
  ["Wyposażenie", LEGACY_EQUIPMENT_HEADERS],
  ["Przedmioty", LEGACY_ITEM_HEADERS],
  ["Zdolności", LEGACY_ABILITY_HEADERS],
  ["Czary", LEGACY_SPELL_HEADERS],
  ["Moce illithidów", LEGACY_ILLITHID_HEADERS],
  ["Dziennik zmian", LEGACY_CHANGE_LOG_HEADERS],
]);
const EXCELJS_LOAD_OPTIONS = { ignoreNodes: ["tableParts"] };
const { Workbook } = ExcelJS;

export async function parseLegacyTrackerWorkbook(
  filePath: string,
  limits: LegacyWorkbookLimits = DEFAULT_LEGACY_WORKBOOK_LIMITS,
): Promise<LegacyTrackerStage> {
  validateLimits(limits);
  let bytes: Uint8Array;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new LegacyTrackerWorkbookError(
      "SOURCE_READ_FAILED",
      "Nie udało się odczytać źródłowego pliku XLSX.",
    );
  }
  if (bytes.byteLength > limits.maxBytes) {
    throw new LegacyTrackerWorkbookError("FILE_TOO_LARGE", "Plik XLSX przekracza limit rozmiaru.");
  }

  const parsedSheets =
    (await tryParseDocumentWorkbook(bytes, limits)) ??
    (await parseCompatibleDocumentWorkbook(bytes, limits));
  validateSheetSet([...parsedSheets.keys()]);
  return {
    profile: LEGACY_TRACKER_PROFILE,
    workbookSha256: createHash("sha256").update(bytes).digest("hex"),
    characters: stagedRows<LegacyCharacterRow>(parsedSheets, "Postacie"),
    equipment: stagedRows<LegacyEquipmentRow>(parsedSheets, "Wyposażenie"),
    items: stagedRows<LegacyItemRow>(parsedSheets, "Przedmioty"),
    abilities: stagedRows<LegacyAbilityRow>(parsedSheets, "Zdolności"),
    spells: stagedRows<LegacySpellRow>(parsedSheets, "Czary"),
    illithidPowers: stagedRows<LegacyIllithidRow>(parsedSheets, "Moce illithidów"),
    legacyChangeLog: stagedRows<LegacyChangeLogRow>(parsedSheets, "Dziennik zmian"),
  };
}

async function tryParseDocumentWorkbook(
  bytes: Uint8Array,
  limits: LegacyWorkbookLimits,
): Promise<ReadonlyMap<string, readonly LegacyStagedRow<string>[] | null> | null> {
  const workbook = new Workbook();
  try {
    const payload = Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(payload, EXCELJS_LOAD_OPTIONS);
  } catch {
    return null;
  }
  return parseLoadedWorkbook(workbook, limits);
}

function parseLoadedWorkbook(
  workbook: ExcelWorkbook,
  limits: LegacyWorkbookLimits,
): ReadonlyMap<string, readonly LegacyStagedRow<string>[] | null> {
  if (workbook.worksheets.length > limits.maxSheets) {
    throw new LegacyTrackerWorkbookError(
      "SHEET_LIMIT_EXCEEDED",
      "Skoroszyt przekracza limit arkuszy.",
    );
  }
  const parsedSheets = new Map<string, readonly LegacyStagedRow<string>[] | null>();
  for (const worksheet of workbook.worksheets) {
    if (parsedSheets.has(worksheet.name)) {
      throw new LegacyTrackerWorkbookError(
        "UNEXPECTED_SHEET",
        `Nazwa arkusza jest powtórzona: ${worksheet.name}.`,
      );
    }
    const state = createSheetState(worksheet.name, HEADERS_BY_SHEET.get(worksheet.name));
    for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
      consumeRow(state, worksheet.getRow(rowNumber), limits);
    }
    finishSheet(state);
    parsedSheets.set(worksheet.name, state.expectedHeaders === undefined ? null : state.rows);
  }
  return parsedSheets;
}

async function parseCompatibleDocumentWorkbook(
  bytes: Uint8Array,
  limits: LegacyWorkbookLimits,
): Promise<ReadonlyMap<string, readonly LegacyStagedRow<string>[] | null>> {
  const normalizedBytes = normalizeLegacyWorkbookNamespace(bytes, limits);
  const workbook = new Workbook();
  try {
    const payload = Buffer.from(normalizedBytes) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(payload, EXCELJS_LOAD_OPTIONS);
  } catch {
    throw new LegacyTrackerWorkbookError(
      "MALFORMED_WORKBOOK",
      "Nie udało się odczytać pliku XLSX.",
    );
  }
  return parseLoadedWorkbook(workbook, limits);
}

const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_MINIMUM_BYTES = 22;
const ZIP_MAXIMUM_COMMENT_BYTES = 65_535;
const OPENXML_WORKBOOK_PATH = "xl/workbook.xml";
const SPREADSHEET_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const PREFIXED_SPREADSHEET_BINDING = `xmlns:x="${SPREADSHEET_NAMESPACE}"`;
const DEFAULT_SPREADSHEET_BINDING = `xmlns="${SPREADSHEET_NAMESPACE}"`;
const LEGACY_SPREADSHEET_XML_MANIFEST = new Map<string, string>([
  [OPENXML_WORKBOOK_PATH, "workbook"],
  ["xl/sharedStrings.xml", "sst"],
  ["xl/styles.xml", "styleSheet"],
  ...Array.from(
    { length: 10 },
    (_, index) => [`xl/worksheets/sheet${index + 1}.xml`, "worksheet"] as const,
  ),
  ...Array.from({ length: 8 }, (_, index) => [`xl/tables/table${index + 1}.xml`, "table"] as const),
]);

function normalizeLegacyWorkbookNamespace(
  bytes: Uint8Array,
  limits: LegacyWorkbookLimits,
): Uint8Array {
  validateZipDirectory(bytes, limits);
  let archive: Unzipped;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new LegacyTrackerWorkbookError(
      "UNSAFE_ARCHIVE",
      "Pakiet XLSX nie jest poprawnym obsługiwanym archiwum ZIP.",
    );
  }
  const manifestPaths = new Set(LEGACY_SPREADSHEET_XML_MANIFEST.keys());
  for (const [path, content] of Object.entries(archive)) {
    if (!path.endsWith(".xml") || manifestPaths.has(path)) continue;
    if (decodeUtf8Xml(content).includes(PREFIXED_SPREADSHEET_BINDING)) {
      throw new LegacyTrackerWorkbookError(
        "LEGACY_NAMESPACE_UNSUPPORTED",
        "Pakiet XLSX zawiera dodatkową część SpreadsheetML poza profilem legacy.",
      );
    }
  }
  for (const [path, expectedRoot] of LEGACY_SPREADSHEET_XML_MANIFEST) {
    const content = archive[path];
    if (content === undefined) {
      throw new LegacyTrackerWorkbookError(
        "LEGACY_NAMESPACE_UNSUPPORTED",
        "Pakiet XLSX nie zawiera pełnego manifestu XML profilu legacy.",
      );
    }
    archive[path] = strToU8(normalizeSpreadsheetXmlPart(content, expectedRoot));
  }

  const workbookXml = decodeUtf8Xml(archive[OPENXML_WORKBOOK_PATH]!);
  const sheetCount = [...workbookXml.matchAll(/<sheet\b/gu)].length;
  if (sheetCount !== LEGACY_TRACKER_SHEETS.length) {
    throw new LegacyTrackerWorkbookError(
      "LEGACY_NAMESPACE_UNSUPPORTED",
      "Profil legacy ma niezgodną liczbę relacji arkuszy.",
    );
  }

  return zipSync(archive, { level: 6, mtime: new Date("1980-01-01T00:00:00.000Z") });
}

function normalizeSpreadsheetXmlPart(content: Uint8Array, expectedRoot: string): string {
  const xml = decodeUtf8Xml(content);
  if (
    countOccurrences(xml, PREFIXED_SPREADSHEET_BINDING) !== 1 ||
    !new RegExp(`<x:${expectedRoot}\\b`, "u").test(xml)
  ) {
    throw new LegacyTrackerWorkbookError(
      "LEGACY_NAMESPACE_UNSUPPORTED",
      "Część XML nie używa oczekiwanego wariantu przestrzeni nazw legacy.",
    );
  }

  const normalizedXml = xml
    .replace(PREFIXED_SPREADSHEET_BINDING, DEFAULT_SPREADSHEET_BINDING)
    .replace(/<(\/?)x:/gu, "<$1");
  const root = normalizedXml.match(new RegExp(`<${expectedRoot}\\b[^>]*>`, "u"))?.[0];
  if (
    root === undefined ||
    !root.includes(DEFAULT_SPREADSHEET_BINDING) ||
    /<\/?x:/u.test(normalizedXml) ||
    namespaceNeutralProjection(xml, true) !== namespaceNeutralProjection(normalizedXml, false)
  ) {
    throw new LegacyTrackerWorkbookError(
      "LEGACY_NAMESPACE_UNSUPPORTED",
      "Nie udało się zachować części XML podczas normalizacji przestrzeni nazw.",
    );
  }
  return normalizedXml;
}

function namespaceNeutralProjection(xml: string, prefixed: boolean): string {
  const binding = prefixed ? PREFIXED_SPREADSHEET_BINDING : DEFAULT_SPREADSHEET_BINDING;
  const withoutBinding = xml.replace(binding, 'xmlns="__SPREADSHEETML__"');
  return prefixed ? withoutBinding.replace(/<(\/?)x:/gu, "<$1") : withoutBinding;
}

function decodeUtf8Xml(content: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new LegacyTrackerWorkbookError(
      "LEGACY_NAMESPACE_UNSUPPORTED",
      "Część XML profilu legacy nie jest poprawnym tekstem UTF-8.",
    );
  }
}

function validateZipDirectory(bytes: Uint8Array, limits: LegacyWorkbookLimits): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findZipEnd(view);
  if (endOffset === null) {
    throw new LegacyTrackerWorkbookError("UNSAFE_ARCHIVE", "Nie znaleziono katalogu ZIP.");
  }
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralOffset + centralSize > endOffset
  ) {
    throw new LegacyTrackerWorkbookError(
      "UNSAFE_ARCHIVE",
      "Wieloczęściowy albo ZIP64 XLSX nie jest obsługiwany.",
    );
  }
  if (entryCount > limits.maxArchiveEntries) {
    throw new LegacyTrackerWorkbookError(
      "ARCHIVE_LIMIT_EXCEEDED",
      "Pakiet XLSX przekracza limit liczby wpisów.",
    );
  }

  const names = new Set<string>();
  let totalUncompressedBytes = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    requireRange(view, cursor, 46);
    if (view.getUint32(cursor, true) !== ZIP_CENTRAL_SIGNATURE) {
      throw new LegacyTrackerWorkbookError("UNSAFE_ARCHIVE", "Katalog ZIP jest uszkodzony.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const compression = view.getUint16(cursor + 10, true);
    const uncompressedBytes = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    requireRange(view, cursor, recordLength);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeZipEntryName(nameBytes);
    if (
      flags & 1 ||
      (compression !== 0 && compression !== 8) ||
      isUnsafeZipPath(name) ||
      names.has(name)
    ) {
      throw new LegacyTrackerWorkbookError(
        "UNSAFE_ARCHIVE",
        "Pakiet XLSX zawiera niebezpieczny albo nieobsługiwany wpis ZIP.",
      );
    }
    names.add(name);
    if (uncompressedBytes > limits.maxEntryUncompressedBytes) {
      throw new LegacyTrackerWorkbookError(
        "ARCHIVE_LIMIT_EXCEEDED",
        "Wpis pakietu XLSX przekracza limit rozmiaru.",
      );
    }
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > limits.maxArchiveUncompressedBytes) {
      throw new LegacyTrackerWorkbookError(
        "ARCHIVE_LIMIT_EXCEEDED",
        "Pakiet XLSX przekracza łączny limit rozmiaru po rozpakowaniu.",
      );
    }
    cursor += recordLength;
  }
  if (cursor !== centralOffset + centralSize || !names.has(OPENXML_WORKBOOK_PATH)) {
    throw new LegacyTrackerWorkbookError(
      "UNSAFE_ARCHIVE",
      "Katalog ZIP nie odpowiada wymaganemu pakietowi XLSX.",
    );
  }
}

function findZipEnd(view: DataView): number | null {
  const earliest = Math.max(0, view.byteLength - ZIP_END_MINIMUM_BYTES - ZIP_MAXIMUM_COMMENT_BYTES);
  for (let offset = view.byteLength - ZIP_END_MINIMUM_BYTES; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) !== ZIP_END_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + ZIP_END_MINIMUM_BYTES + commentLength === view.byteLength) return offset;
  }
  return null;
}

function requireRange(view: DataView, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > view.byteLength) {
    throw new LegacyTrackerWorkbookError("UNSAFE_ARCHIVE", "Katalog ZIP jest ucięty.");
  }
}

function decodeZipEntryName(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new LegacyTrackerWorkbookError("UNSAFE_ARCHIVE", "Nazwa wpisu ZIP nie jest UTF-8.");
  }
}

function isUnsafeZipPath(path: string): boolean {
  const segments = path.split("/");
  return (
    path === "" ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path) ||
    segments.some((segment) => segment === "." || segment === "..")
  );
}

function countOccurrences(value: string, fragment: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(fragment, offset)) !== -1) {
    count += 1;
    offset += fragment.length;
  }
  return count;
}

interface SheetState {
  readonly sheetName: string;
  readonly expectedHeaders: readonly string[] | undefined;
  readonly rows: LegacyStagedRow<string>[];
  columns: ReadonlyMap<string, number> | null;
  rowCount: number;
}

function createSheetState(
  sheetName: string,
  expectedHeaders: readonly string[] | undefined,
): SheetState {
  return { sheetName, expectedHeaders, rows: [], columns: null, rowCount: 0 };
}

function consumeRow(state: SheetState, row: Row, limits: LegacyWorkbookLimits): void {
  state.rowCount += 1;
  if (row.number > limits.maxRowsPerSheet || state.rowCount > limits.maxRowsPerSheet) {
    throw new LegacyTrackerWorkbookError(
      "ROW_LIMIT_EXCEEDED",
      `Arkusz ${state.sheetName} przekracza limit wierszy.`,
    );
  }
  if (row.cellCount > limits.maxColumnsPerSheet) {
    throw new LegacyTrackerWorkbookError(
      "COLUMN_LIMIT_EXCEEDED",
      `Arkusz ${state.sheetName} przekracza limit kolumn.`,
    );
  }
  validateAllCells(row, limits);
  if (state.expectedHeaders === undefined) return;
  if (row.number === 1) {
    state.columns = readHeaderColumns(row, state.expectedHeaders, limits);
    return;
  }
  if (state.columns === null) {
    throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Brakuje wiersza nagłówków.");
  }
  const cells = Object.fromEntries(
    state.expectedHeaders.map((header) => {
      const column = state.columns?.get(header);
      if (column === undefined) {
        throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Brakuje kolumny po walidacji.");
      }
      return [header, readCell(row.getCell(column).value, column, limits)] as const;
    }),
  );
  const stagedCells = Object.values(cells);
  if (stagedCells.every((cell) => cell.value === null && cell.formula === null)) return;
  state.rows.push({ sheet: state.sheetName, row: row.number, cells });
}

function finishSheet(state: SheetState): void {
  if (state.expectedHeaders !== undefined && state.columns === null) {
    throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Brakuje wiersza nagłówków.");
  }
}

function readHeaderColumns(
  row: Row,
  expectedHeaders: readonly string[],
  limits: LegacyWorkbookLimits,
): ReadonlyMap<string, number> {
  const actualHeaders: { readonly header: string; readonly column: number }[] = [];
  for (let column = 1; column <= row.cellCount; column += 1) {
    const value = readCell(row.getCell(column).value, column, limits);
    if (value.formula !== null || typeof value.value !== "string") {
      throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Nagłówki muszą być tekstem.");
    }
    actualHeaders.push({ header: value.value, column });
  }
  if (actualHeaders.length !== expectedHeaders.length) {
    throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Zestaw nagłówków jest niezgodny.");
  }
  const expected = new Set(expectedHeaders);
  const columns = new Map<string, number>();
  for (const value of actualHeaders) {
    if (!expected.has(value.header) || columns.has(value.header)) {
      throw new LegacyTrackerWorkbookError(
        "HEADER_INVALID",
        "Nagłówek jest nieznany albo powtórzony.",
      );
    }
    columns.set(value.header, value.column);
  }
  if (columns.size !== expectedHeaders.length) {
    throw new LegacyTrackerWorkbookError("HEADER_INVALID", "Brakuje wymaganego nagłówka.");
  }
  return columns;
}

function validateAllCells(row: Row, limits: LegacyWorkbookLimits): void {
  for (let column = 1; column <= row.cellCount; column += 1) {
    readCell(row.getCell(column).value, column, limits);
  }
}

function readCell(
  cellValue: CellValue,
  column: number,
  limits: LegacyWorkbookLimits,
): LegacyStagedCell {
  const formula = formulaText(cellValue);
  const value = formula === null ? cellValue : formulaResult(cellValue);
  const scalar = scalarValue(value);
  if (typeof scalar === "string" && scalar.length > limits.maxCellTextLength) {
    throw new LegacyTrackerWorkbookError(
      "CELL_TEXT_TOO_LONG",
      "Tekst komórki przekracza limit długości.",
    );
  }
  return { value: scalar, formula, column };
}

function formulaText(value: CellValue): string | null {
  if (typeof value !== "object" || value === null || value instanceof Date) return null;
  if ("formula" in value && typeof value.formula === "string") return value.formula;
  if ("sharedFormula" in value && typeof value.sharedFormula === "string") {
    return value.sharedFormula;
  }
  return null;
}

function formulaResult(value: CellValue): CellValue {
  if (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    "result" in value
  ) {
    return value.result ?? null;
  }
  return null;
}

function scalarValue(value: CellValue): LegacyScalar {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  throw new LegacyTrackerWorkbookError(
    "CELL_VALUE_UNSUPPORTED",
    "Komórka zawiera nieobsługiwany złożony typ danych.",
  );
}

function validateSheetSet(sheetNames: readonly string[]): void {
  const expected = new Set<string>(LEGACY_TRACKER_SHEETS);
  const actual = new Set(sheetNames);
  for (const sheetName of LEGACY_TRACKER_SHEETS) {
    if (!actual.has(sheetName)) {
      throw new LegacyTrackerWorkbookError(
        "REQUIRED_SHEET_MISSING",
        `Brakuje wymaganego arkusza: ${sheetName}.`,
      );
    }
  }
  for (const sheetName of actual) {
    if (!expected.has(sheetName)) {
      throw new LegacyTrackerWorkbookError(
        "UNEXPECTED_SHEET",
        `Nieobsługiwany arkusz w profilu legacy: ${sheetName}.`,
      );
    }
  }
}

function stagedRows<RowType>(
  sheets: ReadonlyMap<string, readonly LegacyStagedRow<string>[] | null>,
  sheetName: string,
): readonly RowType[] {
  const rows = sheets.get(sheetName);
  if (rows === undefined || rows === null) {
    throw new LegacyTrackerWorkbookError(
      "REQUIRED_SHEET_MISSING",
      `Brakuje danych wymaganego arkusza: ${sheetName}.`,
    );
  }
  return rows as readonly RowType[];
}

function validateLimits(limits: LegacyWorkbookLimits): void {
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new TypeError("Limity skoroszytu muszą być dodatnimi liczbami całkowitymi.");
  }
}
