import { createHash } from "node:crypto";

import type { AbilityType, SpellSource } from "../../domain/model/campaign.js";
import type {
  ImportEntityKind,
  ImportReportEntry,
  ImportSourceLocation,
} from "./import-contracts.js";
import type {
  LegacyNormalizationIssue,
  NormalizedLegacyCharacter,
} from "./legacy-character-normalizer.js";
import {
  mapLegacyAbilityType,
  mapLegacyPrepared,
  mapLegacySpellSource,
  mapLegacyYesNo,
  normalizePolishMatchingKey,
} from "./legacy-normalization.js";
import type {
  LegacyAbilityRow,
  LegacyIllithidRow,
  LegacySpellRow,
  LegacyStagedCell,
  LegacyTrackerStage,
} from "./legacy-tracker-stage.js";

export interface NormalizedLegacyAbilityAssignment {
  readonly characterCanonicalName: string;
  readonly source: string;
  readonly levelAcquired: number | null;
  readonly notes: string | null;
  readonly location: ImportSourceLocation;
}

export interface NormalizedLegacyAbility {
  readonly sourceKey: string;
  readonly source: ImportSourceLocation;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: null;
  readonly type: AbilityType;
  readonly verificationStatus: "UNKNOWN";
  readonly assignments: readonly NormalizedLegacyAbilityAssignment[];
}

export interface NormalizedLegacySpellAssignment {
  readonly characterCanonicalName: string;
  readonly source: SpellSource;
  readonly known: boolean;
  readonly prepared: boolean;
  readonly alwaysPrepared: false;
  readonly notes: string | null;
  readonly location: ImportSourceLocation;
}

export interface NormalizedLegacySpell {
  readonly sourceKey: string;
  readonly source: ImportSourceLocation;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: null;
  readonly level: number;
  readonly verificationStatus: "UNKNOWN";
  readonly assignments: readonly NormalizedLegacySpellAssignment[];
}

export interface NormalizedLegacyIllithidAssignment {
  readonly characterCanonicalName: string;
  readonly acquisitionSourcePl: "WYKUPIONA";
  readonly notes: string | null;
  readonly location: ImportSourceLocation;
}

export interface NormalizedLegacyIllithidPower {
  readonly sourceKey: string;
  readonly source: ImportSourceLocation;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: null;
  readonly tier: null;
  readonly verificationStatus: "UNKNOWN";
  readonly pathRequirementPl: string | null;
  readonly prerequisiteNamePl: string | null;
  readonly assignments: readonly NormalizedLegacyIllithidAssignment[];
}

export interface LegacyCapabilityNormalizationResult {
  readonly abilities: readonly NormalizedLegacyAbility[];
  readonly spells: readonly NormalizedLegacySpell[];
  readonly illithidPowers: readonly NormalizedLegacyIllithidPower[];
  readonly skipped: readonly ImportReportEntry[];
  readonly issues: readonly LegacyNormalizationIssue[];
}

export function normalizeLegacyCapabilities(
  stage: LegacyTrackerStage,
  characters: readonly NormalizedLegacyCharacter[],
): LegacyCapabilityNormalizationResult {
  const characterByDisplayName = new Map(characters.map((value) => [value.displayNamePl, value]));
  const issues: LegacyNormalizationIssue[] = [];
  const skipped: ImportReportEntry[] = [];
  const abilities = normalizeAbilities(stage, characterByDisplayName, issues);
  const spells = normalizeSpells(stage, characterByDisplayName, issues);
  const illithidPowers = normalizeIllithidPowers(stage, characterByDisplayName, issues, skipped);
  return {
    abilities,
    spells,
    illithidPowers,
    skipped: sortReportEntries(skipped),
    issues: sortReportEntries(issues),
  };
}

function normalizeAbilities(
  stage: LegacyTrackerStage,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): readonly NormalizedLegacyAbility[] {
  const values = new Map<string, MutableAbility>();
  for (const row of stage.abilities) {
    const issueStart = issues.length;
    const displayName = requiredAbilityText(stage, row, "Postać", issues);
    const typeToken = requiredAbilityText(stage, row, "Typ", issues);
    const namePl = requiredAbilityText(stage, row, "Nazwa", issues);
    const status = requiredAbilityText(stage, row, "Status", issues);
    const notes = optionalAbilityText(stage, row, "Uwagi", issues);
    const character =
      displayName === null ? null : resolveCharacter(stage, row, displayName, characters, issues);
    const type = typeToken === null ? null : mapLegacyAbilityType(typeToken);
    if (typeToken !== null && type === null)
      issues.push(
        capabilityIssue(stage, row, "Typ", "ability", "ABILITY_TYPE_UNKNOWN", false, {
          value: typeToken,
        }),
      );
    const levelAcquired = abilityLevel(stage, row, issues);
    if (status !== null && status !== "Aktywne")
      issues.push(
        capabilityIssue(
          stage,
          row,
          "Status",
          "character_ability",
          "ABILITY_STATUS_UNKNOWN",
          false,
          { value: status },
        ),
      );
    if (
      issues.length !== issueStart ||
      character === null ||
      type === null ||
      typeToken === null ||
      namePl === null
    )
      continue;
    const key = `${normalizePolishMatchingKey(namePl)}|${type}`;
    const value = values.get(key) ?? {
      sourceKey: `ability:${key}`,
      source: abilityLocation(stage, row, null),
      namePl,
      normalizedNamePl: normalizePolishMatchingKey(namePl),
      nameEn: null,
      type,
      verificationStatus: "UNKNOWN",
      assignments: [],
    };
    if (value.namePl !== namePl) {
      issues.push(
        capabilityIssue(stage, row, "Nazwa", "ability", "ABILITY_NAME_COLLISION", true, {
          key,
          namePl,
        }),
      );
      continue;
    }
    const assignment: NormalizedLegacyAbilityAssignment = {
      characterCanonicalName: character.canonicalName,
      source: abilityAssignmentSource(typeToken, levelAcquired),
      levelAcquired,
      notes,
      location: abilityLocation(stage, row, null),
    };
    if (!value.assignments.some((candidate) => abilityAssignmentEquals(candidate, assignment)))
      value.assignments.push(assignment);
    values.set(key, value);
  }
  return [...values.values()]
    .map(freezeAbility)
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey, "pl-PL"));
}

function abilityAssignmentSource(typeToken: string, levelAcquired: number | null): string {
  return levelAcquired === null ? typeToken : `${typeToken} — poziom ${levelAcquired}`;
}

function normalizeSpells(
  stage: LegacyTrackerStage,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): readonly NormalizedLegacySpell[] {
  const values = new Map<string, MutableSpell>();
  for (const row of stage.spells) {
    const issueStart = issues.length;
    const displayName = requiredSpellText(stage, row, "Postać", issues);
    const namePl = requiredSpellText(stage, row, "Czar", issues);
    const sourceToken = requiredSpellText(stage, row, "Źródło", issues);
    const knownToken = requiredSpellText(stage, row, "Znany / dostępny", issues);
    const preparedToken = requiredSpellText(stage, row, "Przygotowany", issues);
    const notes = optionalSpellText(stage, row, "Uwagi", issues);
    const character =
      displayName === null ? null : resolveCharacter(stage, row, displayName, characters, issues);
    const level = strictNumber(row.cells["Poziom czaru"], 0, 9);
    if (level === null)
      issues.push(
        capabilityIssue(
          stage,
          row,
          "Poziom czaru",
          "spell",
          "SPELL_LEVEL_INVALID",
          true,
          cellFacts(row.cells["Poziom czaru"]),
        ),
      );
    const source = sourceToken === null ? null : mapLegacySpellSource(sourceToken);
    if (sourceToken !== null && source === null)
      issues.push(
        capabilityIssue(stage, row, "Źródło", "character_spell", "SPELL_SOURCE_UNKNOWN", false, {
          value: sourceToken,
        }),
      );
    const known = knownToken === null ? null : mapLegacyYesNo(knownToken);
    if (knownToken !== null && known === null)
      issues.push(
        capabilityIssue(
          stage,
          row,
          "Znany / dostępny",
          "character_spell",
          "SPELL_KNOWN_UNKNOWN",
          false,
          { value: knownToken },
        ),
      );
    const prepared = preparedToken === null ? null : mapLegacyPrepared(preparedToken);
    if (preparedToken !== null && prepared === null)
      issues.push(
        capabilityIssue(
          stage,
          row,
          "Przygotowany",
          "character_spell",
          "SPELL_PREPARED_UNKNOWN",
          false,
          { value: preparedToken },
        ),
      );
    if (
      issues.length !== issueStart ||
      character === null ||
      namePl === null ||
      level === null ||
      source === null ||
      known === null ||
      prepared === null
    )
      continue;
    const key = `${normalizePolishMatchingKey(namePl)}|${level}`;
    const value = values.get(key) ?? {
      sourceKey: `spell:${key}`,
      source: spellLocation(stage, row, null),
      namePl,
      normalizedNamePl: normalizePolishMatchingKey(namePl),
      nameEn: null,
      level,
      verificationStatus: "UNKNOWN",
      assignments: [],
    };
    if (value.namePl !== namePl) {
      issues.push(
        capabilityIssue(stage, row, "Czar", "spell", "SPELL_NAME_COLLISION", true, { key, namePl }),
      );
      continue;
    }
    const assignment: NormalizedLegacySpellAssignment = {
      characterCanonicalName: character.canonicalName,
      source,
      known,
      prepared,
      alwaysPrepared: false,
      notes,
      location: spellLocation(stage, row, null),
    };
    if (!value.assignments.some((candidate) => spellAssignmentEquals(candidate, assignment)))
      value.assignments.push(assignment);
    values.set(key, value);
  }
  return [...values.values()]
    .map(freezeSpell)
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey, "pl-PL"));
}

function normalizeIllithidPowers(
  stage: LegacyTrackerStage,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
  skipped: ImportReportEntry[],
): readonly NormalizedLegacyIllithidPower[] {
  const values = new Map<string, MutableIllithidPower>();
  for (const row of stage.illithidPowers) {
    const issueStart = issues.length;
    const displayName = requiredIllithidText(stage, row, "Postać", issues);
    const namePl = requiredIllithidText(stage, row, "Moc", issues);
    const status = requiredIllithidText(stage, row, "Status", issues);
    const pathRequirementPl = optionalIllithidText(stage, row, "Ścieżka / wymóg", issues);
    const notes = optionalIllithidText(stage, row, "Uwagi", issues);
    const character =
      displayName === null ? null : resolveCharacter(stage, row, displayName, characters, issues);
    if (
      namePl === "—" &&
      status === "BRAK MOCY" &&
      character !== null &&
      issues.length === issueStart
    ) {
      skipped.push(skippedPlaceholder(stage, row));
      continue;
    }
    if (
      status !== null &&
      !["WYKUPIONA", "DOSTĘPNA — BRAK KIJANKI", "ZABLOKOWANA"].includes(status)
    )
      issues.push(
        capabilityIssue(stage, row, "Status", "illithid_power", "ILLITHID_STATUS_UNKNOWN", false, {
          value: status,
        }),
      );
    if (issues.length !== issueStart || character === null || namePl === null || status === null)
      continue;
    const key = normalizePolishMatchingKey(namePl);
    const prerequisiteNamePl = pathRequirementPl?.match(/^Za (.+)$/u)?.[1] ?? null;
    const value = values.get(key) ?? {
      sourceKey: `illithid:${key}`,
      source: illithidLocation(stage, row, null),
      namePl,
      normalizedNamePl: key,
      nameEn: null,
      tier: null,
      verificationStatus: "UNKNOWN",
      pathRequirementPl,
      prerequisiteNamePl,
      assignments: [],
    };
    if (value.namePl !== namePl || value.pathRequirementPl !== pathRequirementPl) {
      issues.push(
        capabilityIssue(stage, row, "Moc", "illithid_power", "ILLITHID_POWER_COLLISION", true, {
          key,
          namePl,
        }),
      );
      continue;
    }
    if (status === "WYKUPIONA") {
      const assignment: NormalizedLegacyIllithidAssignment = {
        characterCanonicalName: character.canonicalName,
        acquisitionSourcePl: "WYKUPIONA",
        notes,
        location: illithidLocation(stage, row, null),
      };
      if (!value.assignments.some((candidate) => illithidAssignmentEquals(candidate, assignment)))
        value.assignments.push(assignment);
    }
    values.set(key, value);
  }
  const knownNames = new Set(values.keys());
  for (const value of values.values()) {
    if (
      value.prerequisiteNamePl !== null &&
      !knownNames.has(normalizePolishMatchingKey(value.prerequisiteNamePl))
    ) {
      issues.push(
        issueFromLocation(
          stage,
          { ...value.source, field: "Ścieżka / wymóg" },
          value.sourceKey,
          "illithid_prerequisite",
          "ILLITHID_PREREQUISITE_UNKNOWN",
          false,
          { prerequisiteNamePl: value.prerequisiteNamePl },
        ),
      );
    }
  }
  return [...values.values()]
    .map(freezeIllithid)
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey, "pl-PL"));
}

interface MutableAbility extends Omit<NormalizedLegacyAbility, "assignments"> {
  assignments: NormalizedLegacyAbilityAssignment[];
}
interface MutableSpell extends Omit<NormalizedLegacySpell, "assignments"> {
  assignments: NormalizedLegacySpellAssignment[];
}
interface MutableIllithidPower extends Omit<NormalizedLegacyIllithidPower, "assignments"> {
  assignments: NormalizedLegacyIllithidAssignment[];
}

function freezeAbility(value: MutableAbility): NormalizedLegacyAbility {
  return { ...value, assignments: [...value.assignments] };
}
function freezeSpell(value: MutableSpell): NormalizedLegacySpell {
  return { ...value, assignments: [...value.assignments] };
}
function freezeIllithid(value: MutableIllithidPower): NormalizedLegacyIllithidPower {
  return { ...value, assignments: [...value.assignments] };
}

function abilityLevel(
  stage: LegacyTrackerStage,
  row: LegacyAbilityRow,
  issues: LegacyNormalizationIssue[],
): number | null {
  const cell = row.cells["Poziom wyboru"];
  if (cell.value === null && cell.formula === null) return null;
  if (
    cell.formula === null &&
    typeof cell.value === "string" &&
    /^(?:[1-9]|1\d|20)$/u.test(cell.value)
  )
    return Number(cell.value);
  issues.push(
    capabilityIssue(
      stage,
      row,
      "Poziom wyboru",
      "character_ability",
      "ABILITY_LEVEL_INVALID",
      true,
      cellFacts(cell),
    ),
  );
  return null;
}

function resolveCharacter<Row extends LegacyAbilityRow | LegacySpellRow | LegacyIllithidRow>(
  stage: LegacyTrackerStage,
  row: Row,
  displayName: string,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): NormalizedLegacyCharacter | null {
  const character = characters.get(displayName) ?? null;
  if (character === null)
    issues.push(
      issueFromLocation(
        stage,
        { profile: stage.profile, sheet: row.sheet, row: row.row, field: "Postać" },
        `${row.sheet}-row:${row.row}`,
        "character",
        "CAPABILITY_CHARACTER_UNKNOWN",
        false,
        { displayName },
      ),
    );
  return character;
}

function strictNumber(cell: LegacyStagedCell, minimum: number, maximum: number): number | null {
  return cell.formula === null &&
    typeof cell.value === "number" &&
    Number.isInteger(cell.value) &&
    cell.value >= minimum &&
    cell.value <= maximum
    ? cell.value
    : null;
}

type IssueFact = string | number | boolean | null;

function capabilityIssue<Row extends LegacyAbilityRow | LegacySpellRow | LegacyIllithidRow>(
  stage: LegacyTrackerStage,
  row: Row,
  field: keyof Row["cells"] & string,
  entityKind: ImportEntityKind,
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, IssueFact>>,
): LegacyNormalizationIssue {
  return issueFromLocation(
    stage,
    { profile: stage.profile, sheet: row.sheet, row: row.row, field },
    `${row.sheet}-row:${row.row}`,
    entityKind,
    reasonCode,
    blocking,
    rawFacts,
  );
}

function issueFromLocation(
  stage: LegacyTrackerStage,
  source: ImportSourceLocation,
  sourceKey: string,
  entityKind: ImportEntityKind,
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, IssueFact>>,
): LegacyNormalizationIssue {
  const issueId = `issue:${createHash("sha256").update(`${stage.workbookSha256}|${source.sheet}|${source.row}|${source.field}|${reasonCode}`, "utf8").digest("hex").slice(0, 24)}`;
  return {
    issueId,
    category: blocking ? "conflicts" : "ambiguous",
    entityKind,
    source,
    sourceKey,
    reasonCode,
    messagePl: issueMessage(reasonCode),
    blocking,
    canonicalEntityId: null,
    relatedIds: [],
    rawFacts,
  };
}

function requiredAbilityText(
  stage: LegacyTrackerStage,
  row: LegacyAbilityRow,
  field: keyof LegacyAbilityRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return requiredText(stage, row, field, "ability", issues);
}
function optionalAbilityText(
  stage: LegacyTrackerStage,
  row: LegacyAbilityRow,
  field: keyof LegacyAbilityRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return optionalText(stage, row, field, "ability", issues);
}
function requiredSpellText(
  stage: LegacyTrackerStage,
  row: LegacySpellRow,
  field: keyof LegacySpellRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return requiredText(stage, row, field, "spell", issues);
}
function optionalSpellText(
  stage: LegacyTrackerStage,
  row: LegacySpellRow,
  field: keyof LegacySpellRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return optionalText(stage, row, field, "spell", issues);
}
function requiredIllithidText(
  stage: LegacyTrackerStage,
  row: LegacyIllithidRow,
  field: keyof LegacyIllithidRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return requiredText(stage, row, field, "illithid_power", issues);
}
function optionalIllithidText(
  stage: LegacyTrackerStage,
  row: LegacyIllithidRow,
  field: keyof LegacyIllithidRow["cells"],
  issues: LegacyNormalizationIssue[],
) {
  return optionalText(stage, row, field, "illithid_power", issues);
}

function requiredText<Row extends LegacyAbilityRow | LegacySpellRow | LegacyIllithidRow>(
  stage: LegacyTrackerStage,
  row: Row,
  field: keyof Row["cells"] & string,
  entityKind: ImportEntityKind,
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = (row.cells as Readonly<Record<string, LegacyStagedCell>>)[field]!;
  if (cell.formula === null && typeof cell.value === "string" && cell.value.trim() !== "")
    return cell.value;
  issues.push(
    capabilityIssue(stage, row, field, entityKind, "REQUIRED_TEXT_INVALID", true, cellFacts(cell)),
  );
  return null;
}

function optionalText<Row extends LegacyAbilityRow | LegacySpellRow | LegacyIllithidRow>(
  stage: LegacyTrackerStage,
  row: Row,
  field: keyof Row["cells"] & string,
  entityKind: ImportEntityKind,
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = (row.cells as Readonly<Record<string, LegacyStagedCell>>)[field]!;
  if (cell.formula === null && cell.value === null) return null;
  if (cell.formula === null && typeof cell.value === "string")
    return cell.value.trim() === "" ? null : cell.value;
  issues.push(
    capabilityIssue(stage, row, field, entityKind, "OPTIONAL_TEXT_INVALID", true, cellFacts(cell)),
  );
  return null;
}

function cellFacts(cell: LegacyStagedCell): Readonly<Record<string, IssueFact>> {
  return {
    value: cell.value instanceof Date ? cell.value.toISOString() : cell.value,
    formula: cell.formula,
  };
}

function abilityLocation(
  stage: LegacyTrackerStage,
  row: LegacyAbilityRow,
  field: keyof LegacyAbilityRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}
function spellLocation(
  stage: LegacyTrackerStage,
  row: LegacySpellRow,
  field: keyof LegacySpellRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}
function illithidLocation(
  stage: LegacyTrackerStage,
  row: LegacyIllithidRow,
  field: keyof LegacyIllithidRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}

function skippedPlaceholder(stage: LegacyTrackerStage, row: LegacyIllithidRow): ImportReportEntry {
  return {
    category: "skipped",
    entityKind: "workbook_content",
    source: illithidLocation(stage, row, "Moc"),
    sourceKey: `illithid-placeholder:${row.row}`,
    reasonCode: "ILLITHID_PLACEHOLDER_EMPTY",
    messagePl: "Wiersz BRAK MOCY nie tworzy encji kanonicznej.",
    blocking: false,
    canonicalEntityId: null,
    relatedIds: [],
  };
}

function abilityAssignmentEquals(
  left: NormalizedLegacyAbilityAssignment,
  right: NormalizedLegacyAbilityAssignment,
): boolean {
  return (
    left.characterCanonicalName === right.characterCanonicalName &&
    left.source === right.source &&
    left.levelAcquired === right.levelAcquired &&
    left.notes === right.notes
  );
}
function spellAssignmentEquals(
  left: NormalizedLegacySpellAssignment,
  right: NormalizedLegacySpellAssignment,
): boolean {
  return (
    left.characterCanonicalName === right.characterCanonicalName &&
    left.source === right.source &&
    left.known === right.known &&
    left.prepared === right.prepared &&
    left.alwaysPrepared === right.alwaysPrepared &&
    left.notes === right.notes
  );
}
function illithidAssignmentEquals(
  left: NormalizedLegacyIllithidAssignment,
  right: NormalizedLegacyIllithidAssignment,
): boolean {
  return left.characterCanonicalName === right.characterCanonicalName && left.notes === right.notes;
}

function issueMessage(reasonCode: string): string {
  const messages: Readonly<Record<string, string>> = {
    REQUIRED_TEXT_INVALID: "Wymagane pole tekstowe ma niepoprawny typ albo jest puste.",
    OPTIONAL_TEXT_INVALID: "Opcjonalne pole tekstowe ma niepoprawny typ.",
    CAPABILITY_CHARACTER_UNKNOWN: "Nie można jednoznacznie wskazać postaci.",
    ABILITY_TYPE_UNKNOWN: "Nieznany typ zdolności wymaga uzgodnienia.",
    ABILITY_LEVEL_INVALID: "Poziom wyboru zdolności ma niepoprawny format.",
    ABILITY_STATUS_UNKNOWN: "Nieznany status zdolności wymaga uzgodnienia.",
    ABILITY_NAME_COLLISION: "Nazwa zdolności koliduje po normalizacji.",
    SPELL_LEVEL_INVALID: "Poziom czaru ma niepoprawny typ lub zakres.",
    SPELL_SOURCE_UNKNOWN: "Nieznane źródło czaru wymaga uzgodnienia.",
    SPELL_KNOWN_UNKNOWN: "Nieznany status dostępności czaru wymaga uzgodnienia.",
    SPELL_PREPARED_UNKNOWN: "Nieznany status przygotowania czaru wymaga uzgodnienia.",
    SPELL_NAME_COLLISION: "Nazwa czaru koliduje po normalizacji.",
    ILLITHID_STATUS_UNKNOWN: "Nieznany status mocy illithidów wymaga uzgodnienia.",
    ILLITHID_POWER_COLLISION: "Moc illithidów ma sprzeczne fakty źródłowe.",
    ILLITHID_PREREQUISITE_UNKNOWN: "Wymaganie mocy illithidów nie wskazuje znanej mocy.",
  };
  return messages[reasonCode] ?? "Dane źródłowe wymagają uzgodnienia.";
}

function sortReportEntries<T extends ImportReportEntry>(entries: readonly T[]): readonly T[] {
  return [...entries].sort(
    (a, b) =>
      a.source.sheet.localeCompare(b.source.sheet, "pl-PL") ||
      a.source.row - b.source.row ||
      (a.source.field ?? "").localeCompare(b.source.field ?? "", "pl-PL") ||
      a.reasonCode.localeCompare(b.reasonCode, "pl-PL"),
  );
}
