import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Workbook } from "exceljs";
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_LEGACY_WORKBOOK_LIMITS,
  LegacyTrackerWorkbookError,
  parseLegacyTrackerWorkbook,
} from "../../../src/adapters/xlsx/legacy-tracker-workbook.js";
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
} from "../../../src/application/import/legacy-tracker-stage.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("legacy tracker workbook adapter", () => {
  it("detects the exact profile and preserves Polish cells and cached formulas", async () => {
    const workbook = sanitizedWorkbook();
    const characters = workbook.getWorksheet("Postacie");
    if (characters === undefined) throw new Error("fixture sheet missing");
    characters.getRow(1).values = [...LEGACY_CHARACTER_HEADERS].reverse();
    const column = new Map(
      [...LEGACY_CHARACTER_HEADERS].reverse().map((header, index) => [header, index + 1] as const),
    );
    const row = characters.getRow(2);
    row.getCell(requiredColumn(column, "ID")).value = "PC_TEST";
    row.getCell(requiredColumn(column, "Postać")).value = "Śmiała Selûne";
    row.getCell(requiredColumn(column, "SIŁ bazowa")).value = 20;
    row.getCell(requiredColumn(column, "Stała premia SIŁ")).value = 2;
    row.getCell(requiredColumn(column, "SIŁ aktualna")).value = {
      formula: "J2+K2",
      result: 22,
    };

    const stage = await parseLegacyTrackerWorkbook(await workbookPath(workbook));

    expect(stage.profile).toBe(LEGACY_TRACKER_PROFILE);
    expect(stage.workbookSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(stage.characters).toHaveLength(1);
    expect(stage.characters[0]?.cells["Postać"].value).toBe("Śmiała Selûne");
    expect(stage.characters[0]?.cells["SIŁ aktualna"]).toMatchObject({
      value: 22,
      formula: "J2+K2",
    });
  });

  it("rejects missing sheets and unexpected headers instead of guessing", async () => {
    const missingSheet = sanitizedWorkbook();
    missingSheet.removeWorksheet(missingSheet.getWorksheet("Czary")?.id ?? -1);
    await expect(
      parseLegacyTrackerWorkbook(await workbookPath(missingSheet)),
    ).rejects.toMatchObject({ code: "REQUIRED_SHEET_MISSING" });

    const wrongHeader = sanitizedWorkbook();
    const items = wrongHeader.getWorksheet("Przedmioty");
    if (items === undefined) throw new Error("fixture sheet missing");
    items.getCell("A1").value = "Nazwa podobna";
    await expect(parseLegacyTrackerWorkbook(await workbookPath(wrongHeader))).rejects.toMatchObject(
      { code: "HEADER_INVALID" },
    );
  });

  it("enforces byte and cell-text limits before returning staged data", async () => {
    const path = await workbookPath(sanitizedWorkbook());
    await expect(
      parseLegacyTrackerWorkbook(path, { ...DEFAULT_LEGACY_WORKBOOK_LIMITS, maxBytes: 1 }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });

    const longText = sanitizedWorkbook();
    const characters = longText.getWorksheet("Postacie");
    if (characters === undefined) throw new Error("fixture sheet missing");
    characters.getCell("A2").value = "abcd";
    await expect(
      parseLegacyTrackerWorkbook(await workbookPath(longText), {
        ...DEFAULT_LEGACY_WORKBOOK_LIMITS,
        maxCellTextLength: 3,
      }),
    ).rejects.toMatchObject({ code: "CELL_TEXT_TOO_LONG" });
  });

  it("translates malformed XLSX into a typed safe error", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "malformed.xlsx");
    await writeFile(path, "not an xlsx", "utf8");
    await expect(parseLegacyTrackerWorkbook(path)).rejects.toBeInstanceOf(
      LegacyTrackerWorkbookError,
    );
  });

  it("normalizes only the exact 21-part legacy SpreadsheetML profile", async () => {
    const workbook = sanitizedWorkbookWithTables();
    const characters = workbook.getWorksheet("Postacie");
    if (characters === undefined) throw new Error("fixture sheet missing");
    characters.getCell("A2").value = "PC_TEST";
    characters.getCell("B2").value = "Śmiała Selûne";
    characters.getCell("J2").value = 20;
    characters.getCell("K2").value = 2;
    characters.getCell("L2").value = { formula: "J2+K2", result: 22 };

    const direct = await parseLegacyTrackerWorkbook(await workbookPath(workbook));
    const prefixedBytes = prefixLegacySpreadsheetParts(await workbookBytes(workbook));
    const prefixedPath = await bytePath(prefixedBytes);
    const compatible = await parseLegacyTrackerWorkbook(prefixedPath);

    expect(withoutDigest(compatible)).toEqual(withoutDigest(direct));
    expect(compatible.workbookSha256).not.toBe(direct.workbookSha256);
    expect(compatible.workbookSha256).toBe(
      createHash("sha256").update(prefixedBytes).digest("hex"),
    );
    expect(compatible.characters[0]?.cells["Postać"].value).toBe("Śmiała Selûne");
    expect(compatible.characters[0]?.cells["SIŁ aktualna"]).toMatchObject({
      formula: "J2+K2",
      value: 22,
    });
  });

  it("rejects incomplete, extended and wrong-namespace legacy manifests", async () => {
    const prefixed = unzipSync(
      prefixLegacySpreadsheetParts(await workbookBytes(sanitizedWorkbookWithTables())),
    );

    const missing = cloneArchive(prefixed);
    delete missing["xl/tables/table8.xml"];
    await expect(parseLegacyTrackerWorkbook(await archivePath(missing))).rejects.toMatchObject({
      code: "LEGACY_NAMESPACE_UNSUPPORTED",
    });

    const extended = cloneArchive(prefixed);
    extended["xl/extension.xml"] = strToU8(`<x:extension xmlns:x="${SPREADSHEET_NAMESPACE}" />`);
    await expect(parseLegacyTrackerWorkbook(await archivePath(extended))).rejects.toMatchObject({
      code: "LEGACY_NAMESPACE_UNSUPPORTED",
    });

    const wrongNamespace = cloneArchive(prefixed);
    wrongNamespace["xl/workbook.xml"] = strToU8(
      strFromU8(requiredEntry(wrongNamespace, "xl/workbook.xml")).replace(
        SPREADSHEET_NAMESPACE,
        "urn:unsupported",
      ),
    );
    await expect(
      parseLegacyTrackerWorkbook(await archivePath(wrongNamespace)),
    ).rejects.toMatchObject({ code: "LEGACY_NAMESPACE_UNSUPPORTED" });
  });

  it("rejects unsafe paths and declared uncompressed data before compatibility parsing", async () => {
    const prefixedBytes = prefixLegacySpreadsheetParts(
      await workbookBytes(sanitizedWorkbookWithTables()),
    );
    const prefixed = unzipSync(prefixedBytes);
    const unsafe = cloneArchive(prefixed);
    unsafe["../escape.xml"] = strToU8("escape");
    await expect(parseLegacyTrackerWorkbook(await archivePath(unsafe))).rejects.toMatchObject({
      code: "UNSAFE_ARCHIVE",
    });

    await expect(
      parseLegacyTrackerWorkbook(await bytePath(withDuplicateCentralEntry(prefixedBytes))),
    ).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE" });

    await expect(
      parseLegacyTrackerWorkbook(await archivePath(prefixed), {
        ...DEFAULT_LEGACY_WORKBOOK_LIMITS,
        maxArchiveUncompressedBytes: 1,
      }),
    ).rejects.toMatchObject({ code: "ARCHIVE_LIMIT_EXCEEDED" });
  });
});

const SPREADSHEET_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const PREFIXED_PARTS = [
  ["xl/workbook.xml", "workbook"],
  ["xl/sharedStrings.xml", "sst"],
  ["xl/styles.xml", "styleSheet"],
  ...Array.from(
    { length: 10 },
    (_, index) => [`xl/worksheets/sheet${index + 1}.xml`, "worksheet"] as const,
  ),
  ...Array.from({ length: 8 }, (_, index) => [`xl/tables/table${index + 1}.xml`, "table"] as const),
] as const;

function sanitizedWorkbook(): Workbook {
  const workbook = new Workbook();
  for (const sheetName of LEGACY_TRACKER_SHEETS) workbook.addWorksheet(sheetName);
  setHeaders(workbook, "Postacie", LEGACY_CHARACTER_HEADERS);
  setHeaders(workbook, "Wyposażenie", LEGACY_EQUIPMENT_HEADERS);
  setHeaders(workbook, "Przedmioty", LEGACY_ITEM_HEADERS);
  setHeaders(workbook, "Zdolności", LEGACY_ABILITY_HEADERS);
  setHeaders(workbook, "Czary", LEGACY_SPELL_HEADERS);
  setHeaders(workbook, "Moce illithidów", LEGACY_ILLITHID_HEADERS);
  setHeaders(workbook, "Dziennik zmian", LEGACY_CHANGE_LOG_HEADERS);
  return workbook;
}

function sanitizedWorkbookWithTables(): Workbook {
  const workbook = sanitizedWorkbook();
  const tableSheets: readonly (readonly [string, readonly string[]])[] = [
    ["Postacie", LEGACY_CHARACTER_HEADERS],
    ["Wyposażenie", LEGACY_EQUIPMENT_HEADERS],
    ["Przedmioty", LEGACY_ITEM_HEADERS],
    ["Zdolności", LEGACY_ABILITY_HEADERS],
    ["Czary", LEGACY_SPELL_HEADERS],
    ["Moce illithidów", LEGACY_ILLITHID_HEADERS],
    ["Dziennik zmian", LEGACY_CHANGE_LOG_HEADERS],
    ["Zasady pracy", ["Instrukcja"]],
  ];
  tableSheets.forEach(([sheetName, headers], index) => {
    const sheet = workbook.getWorksheet(sheetName);
    if (sheet === undefined) throw new Error(`fixture sheet missing: ${sheetName}`);
    sheet.addTable({
      name: `Tabela${index + 1}`,
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      columns: headers.map((name) => ({ name })),
      rows: [],
    });
  });
  return workbook;
}

function setHeaders(workbook: Workbook, sheetName: string, headers: readonly string[]): void {
  const sheet = workbook.getWorksheet(sheetName);
  if (sheet === undefined) throw new Error(`fixture sheet missing: ${sheetName}`);
  sheet.getRow(1).values = [...headers];
}

async function workbookPath(workbook: Workbook): Promise<string> {
  return bytePath(await workbookBytes(workbook));
}

async function workbookBytes(workbook: Workbook): Promise<Uint8Array> {
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function bytePath(bytes: Uint8Array): Promise<string> {
  const directory = await temporaryDirectory();
  const path = join(directory, "tracker.xlsx");
  await writeFile(path, bytes);
  return path;
}

async function archivePath(archive: Unzipped): Promise<string> {
  return bytePath(zipSync(archive, { mtime: new Date("1980-01-01T00:00:00.000Z") }));
}

function prefixLegacySpreadsheetParts(bytes: Uint8Array): Uint8Array {
  const archive = unzipSync(bytes);
  for (const [path, expectedRoot] of PREFIXED_PARTS) {
    const xml = strFromU8(requiredEntry(archive, path));
    expect(xml).toContain(`<${expectedRoot}`);
    const prefixed = xml
      .replace(`xmlns="${SPREADSHEET_NAMESPACE}"`, `xmlns:x="${SPREADSHEET_NAMESPACE}"`)
      .replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/gu, "<$1x:$2");
    archive[path] = strToU8(prefixed);
  }
  return zipSync(archive, { mtime: new Date("1980-01-01T00:00:00.000Z") });
}

function requiredEntry(archive: Unzipped, path: string): Uint8Array {
  const entry = archive[path];
  if (entry === undefined) throw new Error(`fixture entry missing: ${path}`);
  return entry;
}

function cloneArchive(archive: Unzipped): Unzipped {
  return Object.fromEntries(
    Object.entries(archive).map(([path, content]) => [path, content.slice()]),
  );
}

function withoutDigest(stage: Awaited<ReturnType<typeof parseLegacyTrackerWorkbook>>) {
  return { ...stage, workbookSha256: "<digest>" };
}

function withDuplicateCentralEntry(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  let endOffset = copy.byteLength - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50) endOffset -= 1;
  if (endOffset < 0) throw new Error("fixture ZIP end missing");
  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const namesByLength = new Map<number, Uint8Array>();
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("fixture entry missing");
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const nameOffset = cursor + 46;
    const name = copy.slice(nameOffset, nameOffset + nameLength);
    const earlier = namesByLength.get(nameLength);
    if (earlier !== undefined && !name.every((value, position) => value === earlier[position])) {
      copy.set(earlier, nameOffset);
      return copy;
    }
    namesByLength.set(nameLength, name);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("fixture has no equal-length central names");
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "bg3-m2-xlsx-"));
  temporaryDirectories.push(directory);
  return directory;
}

function requiredColumn(columns: ReadonlyMap<string, number>, header: string): number {
  const column = columns.get(header);
  if (column === undefined) throw new Error(`fixture column missing: ${header}`);
  return column;
}
