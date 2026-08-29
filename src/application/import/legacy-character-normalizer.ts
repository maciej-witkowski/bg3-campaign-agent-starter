import { createHash } from "node:crypto";

import type { AttributeKey } from "../../domain/model/campaign.js";
import type { ImportReportEntry, ImportSourceLocation } from "./import-contracts.js";
import { mapLegacyYesNo } from "./legacy-normalization.js";
import type {
  LegacyCharacterRow,
  LegacyStagedCell,
  LegacyTrackerStage,
} from "./legacy-tracker-stage.js";

export interface NormalizedLegacyPermanentStrengthModifier {
  readonly modifier: number;
  readonly sourceNamePl: string;
  readonly provenanceType: "IMPORT";
  readonly permanent: true;
  readonly active: true;
  readonly notes: string;
  readonly source: ImportSourceLocation;
}

export interface NormalizedLegacyCharacter {
  readonly sourceKey: string;
  readonly source: ImportSourceLocation;
  readonly canonicalName: string;
  readonly displayNamePl: string;
  readonly racePl: string | null;
  readonly classPl: string;
  readonly subclassPl: string | null;
  readonly pactVariantPl: string | null;
  readonly level: number;
  readonly roleSummary: string;
  readonly activeParty: boolean;
  readonly notes: string | null;
  readonly attributes: Readonly<Record<AttributeKey, number>>;
  readonly permanentStrengthModifier: NormalizedLegacyPermanentStrengthModifier | null;
  readonly effectiveStrength: number;
}

export interface LegacyCharacterNormalizationResult {
  readonly characters: readonly NormalizedLegacyCharacter[];
  readonly issues: readonly LegacyNormalizationIssue[];
}

type LegacyIssueFact = string | number | boolean | null;

export interface LegacyNormalizationIssue extends ImportReportEntry {
  readonly issueId: string;
  readonly category: "ambiguous" | "conflicts";
  readonly rawFacts: Readonly<Record<string, LegacyIssueFact>>;
}

const ATTRIBUTE_COLUMNS = {
  STR: "SIŁ bazowa",
  DEX: "ZR",
  CON: "KON",
  INT: "INT",
  WIS: "MĄD",
  CHA: "CHA",
} as const satisfies Record<AttributeKey, keyof LegacyCharacterRow["cells"]>;
const LEGACY_MODIFIER_SOURCE_NAMES: Readonly<Record<string, string>> = {
  "Mikstury Wiecznego Wigoru": "Mikstura Wiecznego Wigoru",
};

export function normalizeLegacyCharacters(
  stage: LegacyTrackerStage,
): LegacyCharacterNormalizationResult {
  const characters: NormalizedLegacyCharacter[] = [];
  const issues: LegacyNormalizationIssue[] = [];
  const seenCanonicalNames = new Map<string, LegacyCharacterRow>();
  const seenDisplayNames = new Map<string, LegacyCharacterRow>();
  for (const row of stage.characters) {
    const normalized = normalizeCharacterRow(stage, row, issues);
    if (normalized === null) continue;
    const duplicate = seenCanonicalNames.get(normalized.canonicalName);
    if (duplicate !== undefined) {
      issues.push(
        issue(stage, row, "ID", "conflicts", "DUPLICATE_CHARACTER_ID", true, {
          value: normalized.canonicalName,
          duplicateRow: duplicate.row,
        }),
      );
      continue;
    }
    const duplicateDisplayName = seenDisplayNames.get(normalized.displayNamePl);
    if (duplicateDisplayName !== undefined) {
      issues.push(
        issue(stage, row, "Postać", "ambiguous", "DUPLICATE_CHARACTER_DISPLAY_NAME", true, {
          value: normalized.displayNamePl,
          duplicateRow: duplicateDisplayName.row,
        }),
      );
      continue;
    }
    seenCanonicalNames.set(normalized.canonicalName, row);
    seenDisplayNames.set(normalized.displayNamePl, row);
    characters.push(normalized);
  }
  return { characters, issues: sortIssues(issues) };
}

function normalizeCharacterRow(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  issues: LegacyNormalizationIssue[],
): NormalizedLegacyCharacter | null {
  const issueStart = issues.length;
  const canonicalName = requiredText(stage, row, "ID", issues);
  const displayNamePl = requiredText(stage, row, "Postać", issues);
  const racePl = optionalText(stage, row, "Rasa", issues);
  const classPl = requiredText(stage, row, "Klasa", issues);
  const subclassPl = optionalText(stage, row, "Podklasa", issues);
  const pactVariantPl = optionalText(stage, row, "Pakt / wariant", issues);
  const roleSummary = requiredText(stage, row, "Rola", issues);
  const notes = optionalText(stage, row, "Uwagi", issues);
  const level = requiredInteger(stage, row, "Poziom", 1, 20, issues);
  const activeParty = mappedBoolean(stage, row, "Aktywna", issues);
  const attributes = Object.fromEntries(
    Object.entries(ATTRIBUTE_COLUMNS).map(([attribute, field]) => [
      attribute,
      requiredInteger(stage, row, field, 1, 30, issues),
    ]),
  ) as Record<AttributeKey, number | null>;
  const permanentBonus = requiredInteger(stage, row, "Stała premia SIŁ", -30, 30, issues);
  const effectiveStrength = requiredInteger(stage, row, "SIŁ aktualna", 1, 60, issues, true);

  let modifier: NormalizedLegacyPermanentStrengthModifier | null = null;
  if (permanentBonus !== null && permanentBonus !== 0) {
    const extracted = notes?.match(/(?:^| )Stałe \+([1-9]\d*) SIŁ z ([^;]+);/u);
    const sourceNamePl =
      extracted?.[2] === undefined ? null : (LEGACY_MODIFIER_SOURCE_NAMES[extracted[2]] ?? null);
    if (
      extracted === null ||
      extracted === undefined ||
      Number(extracted[1]) !== permanentBonus ||
      sourceNamePl === null
    ) {
      issues.push(
        issue(
          stage,
          row,
          "Stała premia SIŁ",
          "conflicts",
          "PERMANENT_STRENGTH_SOURCE_INVALID",
          true,
          { bonus: permanentBonus, notes },
        ),
      );
    } else {
      modifier = {
        modifier: permanentBonus,
        sourceNamePl,
        provenanceType: "IMPORT",
        permanent: true,
        active: true,
        notes: notes!,
        source: location(stage, row, "Stała premia SIŁ"),
      };
    }
  }
  if (
    attributes.STR !== null &&
    permanentBonus !== null &&
    effectiveStrength !== null &&
    effectiveStrength !== attributes.STR + permanentBonus
  ) {
    issues.push(
      issue(stage, row, "SIŁ aktualna", "conflicts", "EFFECTIVE_STRENGTH_MISMATCH", true, {
        baseStrength: attributes.STR,
        permanentBonus,
        effectiveStrength,
      }),
    );
  }

  if (
    issues.length !== issueStart ||
    canonicalName === null ||
    displayNamePl === null ||
    classPl === null ||
    roleSummary === null ||
    level === null ||
    activeParty === null ||
    effectiveStrength === null ||
    Object.values(attributes).some((value) => value === null)
  ) {
    return null;
  }
  return {
    sourceKey: `character:${canonicalName}`,
    source: location(stage, row, null),
    canonicalName,
    displayNamePl,
    racePl,
    classPl,
    subclassPl,
    pactVariantPl,
    level,
    roleSummary,
    activeParty,
    notes,
    attributes: attributes as Record<AttributeKey, number>,
    permanentStrengthModifier: modifier,
    effectiveStrength,
  };
}

function requiredText(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"],
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = row.cells[field];
  if (cell.formula === null && typeof cell.value === "string" && cell.value.trim() !== "") {
    return cell.value;
  }
  issues.push(
    issue(stage, row, field, "conflicts", "REQUIRED_TEXT_INVALID", true, cellFacts(cell)),
  );
  return null;
}

function optionalText(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"],
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = row.cells[field];
  if (cell.formula === null && cell.value === null) return null;
  if (cell.formula === null && typeof cell.value === "string") {
    return cell.value.trim() === "" ? null : cell.value;
  }
  issues.push(
    issue(stage, row, field, "conflicts", "OPTIONAL_TEXT_INVALID", true, cellFacts(cell)),
  );
  return null;
}

function requiredInteger(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"],
  minimum: number,
  maximum: number,
  issues: LegacyNormalizationIssue[],
  allowFormula = false,
): number | null {
  const cell = row.cells[field];
  if (
    (allowFormula || cell.formula === null) &&
    typeof cell.value === "number" &&
    Number.isInteger(cell.value) &&
    cell.value >= minimum &&
    cell.value <= maximum
  ) {
    return cell.value;
  }
  issues.push(
    issue(stage, row, field, "conflicts", "INTEGER_OUT_OF_RANGE", true, {
      ...cellFacts(cell),
      minimum,
      maximum,
    }),
  );
  return null;
}

function mappedBoolean(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"],
  issues: LegacyNormalizationIssue[],
): boolean | null {
  const cell = row.cells[field];
  const mapped =
    cell.formula === null && typeof cell.value === "string" ? mapLegacyYesNo(cell.value) : null;
  if (mapped !== null) return mapped;
  issues.push(
    issue(stage, row, field, "ambiguous", "LEGACY_BOOLEAN_UNKNOWN", false, cellFacts(cell)),
  );
  return null;
}

function issue(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"],
  category: "ambiguous" | "conflicts",
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, LegacyIssueFact>>,
): LegacyNormalizationIssue {
  const source = location(stage, row, field);
  const digest = createHash("sha256")
    .update(`${stage.workbookSha256}|${source.sheet}|${source.row}|${field}|${reasonCode}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  return {
    issueId: `issue:${digest}`,
    category,
    entityKind: "character",
    source,
    sourceKey:
      typeof row.cells.ID.value === "string" && row.cells.ID.value.trim() !== ""
        ? `character:${row.cells.ID.value}`
        : `character-row:${row.row}`,
    reasonCode,
    messagePl: issueMessage(reasonCode),
    blocking,
    canonicalEntityId: null,
    relatedIds: [],
    rawFacts: Object.fromEntries(
      Object.entries(rawFacts).map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 500) : value,
      ]),
    ),
  };
}

function location(
  stage: LegacyTrackerStage,
  row: LegacyCharacterRow,
  field: keyof LegacyCharacterRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}

function cellFacts(cell: LegacyStagedCell): Readonly<Record<string, LegacyIssueFact>> {
  return {
    value: cell.value instanceof Date ? cell.value.toISOString() : cell.value,
    formula: cell.formula,
  };
}

function issueMessage(reasonCode: string): string {
  const messages: Readonly<Record<string, string>> = {
    REQUIRED_TEXT_INVALID: "Wymagane pole tekstowe ma niepoprawny typ albo jest puste.",
    OPTIONAL_TEXT_INVALID: "Opcjonalne pole tekstowe ma niepoprawny typ.",
    INTEGER_OUT_OF_RANGE: "Wartość liczbowa nie jest liczbą całkowitą w dozwolonym zakresie.",
    LEGACY_BOOLEAN_UNKNOWN: "Nieznana wartość pola logicznego wymaga uzgodnienia.",
    PERMANENT_STRENGTH_SOURCE_INVALID: "Stała premia SIŁ nie ma jednoznacznego źródła w notatce.",
    EFFECTIVE_STRENGTH_MISMATCH: "Aktualna SIŁ nie zgadza się z bazą i stałą premią.",
    DUPLICATE_CHARACTER_ID: "Identyfikator postaci powtarza się w trackerze.",
    DUPLICATE_CHARACTER_DISPLAY_NAME:
      "Nazwa wyświetlana postaci powtarza się w trackerze i nie pozwala rozstrzygnąć odwołań.",
  };
  return messages[reasonCode] ?? "Dane źródłowe wymagają uzgodnienia.";
}

function sortIssues(
  issues: readonly LegacyNormalizationIssue[],
): readonly LegacyNormalizationIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.source.row - right.source.row ||
      (left.source.field ?? "").localeCompare(right.source.field ?? "", "pl-PL") ||
      left.reasonCode.localeCompare(right.reasonCode, "pl-PL"),
  );
}
