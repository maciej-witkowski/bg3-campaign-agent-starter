import {
  IMPORT_RECONCILIATION_FORMAT,
  IMPORT_RECONCILIATION_VERSION,
  IMPORT_REPORT_FORMAT,
  IMPORT_REPORT_VERSION,
  type ImportReconciliation,
  type ImportReport,
  type ImportReportEntry,
} from "./import-contracts.js";
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
import type { LegacyTrackerStage } from "./legacy-tracker-stage.js";

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
}

export function normalizeLegacyCampaign(stage: LegacyTrackerStage): NormalizedLegacyCampaign {
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
    entries: sortEntries([...campaign.skipped, ...campaign.issues]),
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
