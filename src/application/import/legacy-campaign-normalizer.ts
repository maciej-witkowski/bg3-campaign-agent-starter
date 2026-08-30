import {
  IMPORT_RECONCILIATION_FORMAT,
  IMPORT_RECONCILIATION_VERSION,
  IMPORT_REPORT_FORMAT,
  IMPORT_REPORT_VERSION,
  type ImportReconciliation,
  type ImportReconciliationResolution,
  type ImportReport,
  type ImportReportEntry,
} from "./import-contracts.js";
import { parseImportReconciliation } from "./import-contracts.js";
import { CampaignDomainError } from "../../domain/mutations/campaign-mutation.js";
import {
  normalizeLegacyCapabilities,
  type NormalizedLegacyAbility,
  type NormalizedLegacyIllithidPower,
  type NormalizedLegacySpell,
} from "./legacy-capability-normalizer.js";
import {
  normalizeLegacyCharacters,
  type LegacyNormalizationIssue,
  type NormalizedLegacyCharacter,
} from "./legacy-character-normalizer.js";
import { normalizeLegacyItems, type NormalizedLegacyItem } from "./legacy-item-normalizer.js";
import type { LegacyStagedRow, LegacyTrackerStage } from "./legacy-tracker-stage.js";
import { reconciliationIssueIdentity } from "./reconciliation-decisions.js";

export interface NormalizedLegacyCampaign {
  readonly workbookProfile: string;
  readonly workbookSha256: string;
  readonly characters: readonly NormalizedLegacyCharacter[];
  readonly items: readonly NormalizedLegacyItem[];
  readonly abilities: readonly NormalizedLegacyAbility[];
  readonly spells: readonly NormalizedLegacySpell[];
  readonly illithidPowers: readonly NormalizedLegacyIllithidPower[];
  readonly issues: readonly LegacyNormalizationIssue[];
  readonly skipped: readonly ImportReportEntry[];
  readonly appliedReconciliationIssues?: readonly ImportReconciliation["issues"][number][];
  readonly reconciliationEntries?: readonly ImportReportEntry[];
}

export function normalizeLegacyCampaign(
  stage: LegacyTrackerStage,
  reconciliationInput?: unknown,
): NormalizedLegacyCampaign {
  const base = normalizeLegacyCampaignCore(stage);
  if (reconciliationInput === undefined) return base;

  const reconciliation = parseImportReconciliation(reconciliationInput);
  assertReconciliationEnvelope(stage, reconciliation);
  const baseIssues = new Map(base.issues.map((issue) => [issue.issueId, issue]));
  let reconciledStage = stage;
  const applied: ImportReconciliation["issues"][number][] = [];
  const entries: ImportReportEntry[] = [];
  const aliases: { readonly row: number; readonly aliasEn: string }[] = [];

  for (const issue of reconciliation.issues) {
    const expected = baseIssues.get(issue.issueId);
    if (expected === undefined) continue;
    assertIssueIdentity(issue, expected);
    if (issue.resolution === null) continue;
    reconciledStage = applyNormalizationResolution(reconciledStage, issue, aliases);
    applied.push(issue);
    entries.push(reconciliationEntry(issue));
  }

  let result = normalizeLegacyCampaignCore(reconciledStage);
  if (aliases.length > 0) {
    const aliasesByRow = new Map(aliases.map((value) => [value.row, value.aliasEn]));
    result = {
      ...result,
      items: result.items.map((item) => {
        const aliasEn =
          item.source.sheet === "Przedmioty" ? aliasesByRow.get(item.source.row) : undefined;
        return aliasEn === undefined ? item : { ...item, nameEn: aliasEn, unresolvedAliasEn: null };
      }),
      issues: result.issues.filter(
        (issue) =>
          !(issue.reasonCode === "ENGLISH_ALIAS_UNATTESTED" && aliasesByRow.has(issue.source.row)),
      ),
    };
  }
  return {
    ...result,
    appliedReconciliationIssues: applied,
    reconciliationEntries: entries,
  };
}

function normalizeLegacyCampaignCore(stage: LegacyTrackerStage): NormalizedLegacyCampaign {
  const characterResult = normalizeLegacyCharacters(stage);
  const itemResult = normalizeLegacyItems(stage, characterResult.characters);
  const capabilityResult = normalizeLegacyCapabilities(stage, characterResult.characters);
  return {
    workbookProfile: stage.profile,
    workbookSha256: stage.workbookSha256,
    characters: characterResult.characters,
    items: itemResult.items,
    abilities: capabilityResult.abilities,
    spells: capabilityResult.spells,
    illithidPowers: capabilityResult.illithidPowers,
    issues: sortEntries([
      ...characterResult.issues,
      ...itemResult.issues,
      ...capabilityResult.issues,
    ]),
    skipped: sortEntries([
      ...staticWorkbookSkips(stage),
      ...legacyChangeLogSkips(stage),
      ...capabilityResult.skipped,
    ]),
  };
}

export function createNormalizationReport(campaign: NormalizedLegacyCampaign): ImportReport {
  return {
    format: IMPORT_REPORT_FORMAT,
    version: IMPORT_REPORT_VERSION,
    workbookProfile: campaign.workbookProfile,
    workbookSha256: campaign.workbookSha256,
    entries: sortEntries([
      ...campaign.skipped,
      ...(campaign.reconciliationEntries ?? []),
      ...campaign.issues,
    ]),
  };
}

function assertReconciliationEnvelope(
  stage: LegacyTrackerStage,
  reconciliation: ImportReconciliation,
): void {
  if (
    reconciliation.workbookProfile !== stage.profile ||
    reconciliation.workbookSha256 !== stage.workbookSha256
  )
    throw new CampaignDomainError(
      "Dokument rekonsyliacji nie dotyczy tego profilu i skrótu skoroszytu.",
    );
}

function assertIssueIdentity(
  issue: ImportReconciliation["issues"][number],
  expected: LegacyNormalizationIssue,
): void {
  const actualIdentity = {
    issueId: issue.issueId,
    entityKind: issue.entityKind,
    source: issue.source,
    category: issue.category,
    reasonCode: issue.reasonCode,
    candidateCanonicalIds: issue.candidateCanonicalIds,
    rawFacts: issue.rawFacts,
  };
  const expectedIdentity = {
    issueId: expected.issueId,
    entityKind: expected.entityKind,
    source: expected.source,
    category: expected.category,
    reasonCode: expected.reasonCode,
    candidateCanonicalIds: [...expected.relatedIds],
    rawFacts: expected.rawFacts,
  };
  if (reconciliationIssueIdentity(actualIdentity) !== reconciliationIssueIdentity(expectedIdentity))
    throw new CampaignDomainError("Problem rekonsyliacji nie odpowiada danym skoroszytu.");
}

function applyNormalizationResolution(
  stage: LegacyTrackerStage,
  issue: ImportReconciliation["issues"][number],
  aliases: { row: number; aliasEn: string }[],
): LegacyTrackerStage {
  const resolution = issue.resolution!;
  if (issue.reasonCode === "DUPLICATE_CHARACTER_DISPLAY_NAME")
    throw new CampaignDomainError(
      "Duplikat nazwy postaci wymaga poprawienia źródłowego trackera i jego zależnych odwołań.",
    );
  if (resolution.action === "attest_verified_alias") {
    if (
      issue.reasonCode !== "ENGLISH_ALIAS_UNATTESTED" ||
      issue.source.sheet !== "Przedmioty" ||
      issue.rawFacts.aliasEn !== resolution.aliasEn
    )
      throw inapplicableResolution(resolution);
    aliases.push({ row: issue.source.row, aliasEn: resolution.aliasEn });
    return stage;
  }
  if (resolution.action === "provide_canonical_value") {
    if (issue.source.field === null) throw inapplicableResolution(resolution);
    return patchStageCell(
      stage,
      issue.source.sheet,
      issue.source.row,
      issue.source.field,
      resolution.value,
    );
  }
  if (resolution.action === "skip")
    return removeStageRow(stage, issue.source.sheet, issue.source.row);
  throw inapplicableResolution(resolution);
}

function inapplicableResolution(resolution: ImportReconciliationResolution): CampaignDomainError {
  return new CampaignDomainError(
    `Akcja ${resolution.action} nie może rozstrzygnąć tego problemu normalizacji.`,
  );
}

function patchStageCell(
  stage: LegacyTrackerStage,
  sheet: string,
  rowNumber: number,
  field: string,
  value: string | number | boolean,
): LegacyTrackerStage {
  let patched = false;
  const patchRows = <T extends LegacyStagedRow<string>>(rows: readonly T[]): readonly T[] =>
    rows.map((row) => {
      if (row.sheet !== sheet || row.row !== rowNumber || !(field in row.cells)) return row;
      patched = true;
      return {
        ...row,
        cells: {
          ...row.cells,
          [field]: { ...row.cells[field]!, value, formula: null },
        },
      };
    });
  const result = mapStageRows(stage, patchRows);
  if (!patched) throw new CampaignDomainError("Pole wskazane w rekonsyliacji nie istnieje.");
  return result;
}

function removeStageRow(
  stage: LegacyTrackerStage,
  sheet: string,
  rowNumber: number,
): LegacyTrackerStage {
  let removed = false;
  const removeRows = <T extends LegacyStagedRow<string>>(rows: readonly T[]): readonly T[] =>
    rows.filter((row) => {
      const keep = row.sheet !== sheet || row.row !== rowNumber;
      if (!keep) removed = true;
      return keep;
    });
  const result = mapStageRows(stage, removeRows);
  return removed ? result : stage;
}

function mapStageRows(
  stage: LegacyTrackerStage,
  mapper: <T extends LegacyStagedRow<string>>(rows: readonly T[]) => readonly T[],
): LegacyTrackerStage {
  return {
    ...stage,
    characters: mapper(stage.characters),
    equipment: mapper(stage.equipment),
    items: mapper(stage.items),
    abilities: mapper(stage.abilities),
    spells: mapper(stage.spells),
    illithidPowers: mapper(stage.illithidPowers),
    legacyChangeLog: mapper(stage.legacyChangeLog),
  };
}

function reconciliationEntry(issue: ImportReconciliation["issues"][number]): ImportReportEntry {
  const skipped = issue.resolution?.action === "skip";
  return {
    category: skipped ? "skipped" : "matched",
    entityKind: issue.entityKind,
    source: issue.source,
    sourceKey: `reconciliation:${issue.issueId}`,
    reasonCode: skipped ? "RECONCILED_SKIP" : "RECONCILIATION_APPLIED",
    messagePl: skipped
      ? "Rekonsyliacja pominęła fakt źródłowy."
      : "Jawna decyzja rekonsyliacji została zastosowana.",
    blocking: false,
    canonicalEntityId:
      issue.resolution?.action === "select_existing" ? issue.resolution.canonicalEntityId : null,
    relatedIds: [],
  };
}

export function createNormalizationReconciliation(
  campaign: NormalizedLegacyCampaign,
): ImportReconciliation {
  return {
    format: IMPORT_RECONCILIATION_FORMAT,
    version: IMPORT_RECONCILIATION_VERSION,
    workbookProfile: campaign.workbookProfile,
    workbookSha256: campaign.workbookSha256,
    issues: campaign.issues.map((issue) => ({
      issueId: issue.issueId,
      entityKind: issue.entityKind,
      source: issue.source,
      category: issue.category,
      reasonCode: issue.reasonCode,
      candidateCanonicalIds: [...issue.relatedIds],
      rawFacts: { ...issue.rawFacts },
      resolution: null,
    })),
  };
}

function staticWorkbookSkips(stage: LegacyTrackerStage): readonly ImportReportEntry[] {
  return [
    skippedEntry(
      stage,
      "Dashboard",
      "LEGACY_DASHBOARD_DERIVED",
      "Arkusz Dashboard jest widokiem pochodnym.",
    ),
    skippedEntry(
      stage,
      "Zasady pracy",
      "LEGACY_INSTRUCTIONS_NON_EXECUTABLE",
      "Arkusz Zasady pracy jest niekanoniczną dokumentacją.",
    ),
    skippedEntry(
      stage,
      "Prompt dla agenta",
      "LEGACY_PROMPT_NON_EXECUTABLE",
      "Arkusz Prompt dla agenta jest niekanoniczną dokumentacją.",
    ),
  ];
}

function legacyChangeLogSkips(stage: LegacyTrackerStage): readonly ImportReportEntry[] {
  return stage.legacyChangeLog.map((row) => ({
    category: "skipped",
    entityKind: "legacy_change_event",
    source: { profile: stage.profile, sheet: row.sheet, row: row.row, field: null },
    sourceKey: `legacy-change-row:${row.row}`,
    reasonCode: "LEGACY_CHANGE_LOG_NOT_AUDIT_HISTORY",
    messagePl: "Historyczny wpis arkusza nie jest importowany jako kanoniczne zdarzenie audytowe.",
    blocking: false,
    canonicalEntityId: null,
    relatedIds: [],
  }));
}

function skippedEntry(
  stage: LegacyTrackerStage,
  sheet: string,
  reasonCode: string,
  messagePl: string,
): ImportReportEntry {
  return {
    category: "skipped",
    entityKind: "workbook_content",
    source: { profile: stage.profile, sheet, row: 1, field: null },
    sourceKey: `workbook-sheet:${sheet}`,
    reasonCode,
    messagePl,
    blocking: false,
    canonicalEntityId: null,
    relatedIds: [],
  };
}

function sortEntries<T extends ImportReportEntry>(entries: readonly T[]): readonly T[] {
  const categoryOrder = new Map([
    ["inserted", 0],
    ["matched", 1],
    ["skipped", 2],
    ["ambiguous", 3],
    ["conflicts", 4],
  ]);
  return [...entries].sort(
    (left, right) =>
      (categoryOrder.get(left.category) ?? 99) - (categoryOrder.get(right.category) ?? 99) ||
      left.entityKind.localeCompare(right.entityKind, "pl-PL") ||
      left.source.sheet.localeCompare(right.source.sheet, "pl-PL") ||
      left.source.row - right.source.row ||
      (left.source.field ?? "").localeCompare(right.source.field ?? "", "pl-PL") ||
      left.reasonCode.localeCompare(right.reasonCode, "pl-PL"),
  );
}
