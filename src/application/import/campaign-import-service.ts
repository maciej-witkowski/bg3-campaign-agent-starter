import { createHash } from "node:crypto";

import {
  CampaignDomainError,
  type CampaignMutationCoordinatorPort,
  type CampaignMutationResult,
  type IdSource,
} from "../../domain/mutations/campaign-mutation.js";
import type { CampaignImportState, CampaignImportStateReadPort } from "./campaign-import-state.js";
import {
  createNormalizationReconciliation,
  createNormalizationReport,
  type NormalizedLegacyCampaign,
} from "./legacy-campaign-normalizer.js";
import {
  materializeAbility,
  materializeIllithidPower,
  materializeSpell,
  planLegacyCapabilityImport,
  type LegacyCapabilityImportPlan,
} from "./legacy-capability-import-planner.js";
import {
  materializeCharacter,
  materializeModifier,
  planLegacyCharacterImport,
  type LegacyCharacterImportPlan,
} from "./legacy-character-import-planner.js";
import {
  materializeInventoryItem,
  materializeItemDefinition,
  materializeItemEffect,
  planLegacyItemImport,
  type LegacyItemImportPlan,
} from "./legacy-item-import-planner.js";
import type { ImportReconciliation, ImportReport, ImportReportEntry } from "./import-contracts.js";

export interface CampaignImportPlan {
  readonly campaign: NormalizedLegacyCampaign;
  readonly stateSha256: string;
  readonly characters: LegacyCharacterImportPlan;
  readonly items: LegacyItemImportPlan;
  readonly capabilities: LegacyCapabilityImportPlan;
  readonly report: ImportReport;
  readonly reconciliation: ImportReconciliation;
  readonly blocked: boolean;
}

export type CampaignImportApplyResult = CampaignMutationResult & { readonly report: ImportReport };

export class CampaignImportService {
  public constructor(
    private readonly stateReader: CampaignImportStateReadPort,
    private readonly coordinator: CampaignMutationCoordinatorPort,
    private readonly ids: IdSource,
  ) {}

  public planImport(campaign: NormalizedLegacyCampaign): CampaignImportPlan {
    const state = this.stateReader.readImportState();
    const characters = planLegacyCharacterImport(campaign, state, this.ids);
    const items = planLegacyItemImport(campaign, state, characters, this.ids);
    const capabilities = planLegacyCapabilityImport(campaign, state, characters, this.ids);
    const report = mergeReport(campaign, [
      ...characters.entries,
      ...items.entries,
      ...capabilities.entries,
    ]);
    const reconciliation = mergeReconciliation(campaign, report.entries);
    return {
      campaign,
      stateSha256: stateDigest(state),
      characters,
      items,
      capabilities,
      report,
      reconciliation,
      blocked: characters.blocked || items.blocked || capabilities.blocked,
    };
  }

  public applyImport(plan: CampaignImportPlan): CampaignImportApplyResult {
    if (plan.blocked)
      throw new CampaignDomainError("Plan importu zawiera konflikty blokujące zapis kampanii.");
    if (stateDigest(this.stateReader.readImportState()) !== plan.stateSha256)
      throw new CampaignDomainError("Stan kampanii zmienił się od utworzenia planu importu.");
    if (!hasWrites(plan)) return { changed: false, report: plan.report };

    const result = this.coordinator.execute(
      {
        type: "CAMPAIGN_IMPORTED",
        summaryPl: "Zaimportowano stan istniejącej kampanii.",
        reasonPl: importReason(plan),
      },
      (writes, context) => {
        for (const value of plan.characters.characters)
          writes.insertCharacter(materializeCharacter(value, context.occurredAt));
        for (const value of plan.characters.attributes) writes.setCharacterAttribute(value);
        for (const value of plan.items.itemDefinitions)
          writes.insertItemDefinition(materializeItemDefinition(value));
        for (const value of plan.items.itemEffects)
          writes.insertItemEffect(materializeItemEffect(value));
        for (const value of plan.characters.permanentModifiers)
          writes.insertPermanentModifier(materializeModifier(value, context.occurredAt));
        for (const value of plan.items.inventoryItems)
          writes.insertInventoryItem(materializeInventoryItem(value));
        for (const value of plan.items.equipment) writes.setEquipment(value);
        for (const value of plan.capabilities.spells) writes.insertSpell(materializeSpell(value));
        for (const value of plan.capabilities.characterSpells) writes.setCharacterSpell(value);
        for (const value of plan.capabilities.abilities)
          writes.insertAbility(materializeAbility(value));
        for (const value of plan.capabilities.characterAbilities) writes.setCharacterAbility(value);
        for (const value of plan.capabilities.illithidPowers)
          writes.insertIllithidPower(materializeIllithidPower(value));
        for (const value of plan.capabilities.illithidPrerequisites)
          writes.setIllithidPrerequisite(value);
        for (const value of plan.capabilities.characterIllithidPowers)
          writes.setCharacterIllithidPower(value);
        return true;
      },
    );
    return { ...result, report: plan.report };
  }
}

function mergeReconciliation(
  campaign: NormalizedLegacyCampaign,
  entries: readonly ImportReportEntry[],
): ImportReconciliation {
  const normalization = createNormalizationReconciliation(campaign);
  const existingKeys = new Set(
    normalization.issues.map((issue) => issueKey(issue.entityKind, issue.source, issue.reasonCode)),
  );
  const plannedIssues = entries
    .filter((entry) => entry.category === "ambiguous" || entry.category === "conflicts")
    .filter(
      (entry) => !existingKeys.has(issueKey(entry.entityKind, entry.source, entry.reasonCode)),
    )
    .map((entry) => ({
      issueId: createHash("sha256")
        .update(
          `${campaign.workbookSha256}\u0000${issueKey(entry.entityKind, entry.source, entry.reasonCode)}\u0000${entry.sourceKey}`,
          "utf8",
        )
        .digest("hex"),
      entityKind: entry.entityKind,
      source: entry.source,
      category: entry.category as "ambiguous" | "conflicts",
      reasonCode: entry.reasonCode,
      candidateCanonicalIds: [
        ...new Set([
          ...entry.relatedIds,
          ...(entry.canonicalEntityId === null ? [] : [entry.canonicalEntityId]),
        ]),
      ].sort(),
      rawFacts: { sourceKey: entry.sourceKey },
      resolution: null,
    }));
  return {
    ...normalization,
    issues: [...normalization.issues, ...plannedIssues].sort((left, right) =>
      left.issueId.localeCompare(right.issueId),
    ),
  };
}

function issueKey(
  entityKind: ImportReportEntry["entityKind"],
  source: ImportReportEntry["source"],
  reasonCode: string,
): string {
  return `${entityKind}\u0000${source.sheet}\u0000${source.row}\u0000${source.field ?? ""}\u0000${reasonCode}`;
}

function hasWrites(plan: CampaignImportPlan): boolean {
  return [
    plan.characters.characters,
    plan.characters.attributes,
    plan.characters.permanentModifiers,
    plan.items.itemDefinitions,
    plan.items.itemEffects,
    plan.items.inventoryItems,
    plan.items.equipment,
    plan.capabilities.spells,
    plan.capabilities.characterSpells,
    plan.capabilities.abilities,
    plan.capabilities.characterAbilities,
    plan.capabilities.illithidPowers,
    plan.capabilities.illithidPrerequisites,
    plan.capabilities.characterIllithidPowers,
  ].some((values) => values.length > 0);
}

function mergeReport(
  campaign: NormalizedLegacyCampaign,
  plannedEntries: readonly ImportReportEntry[],
): ImportReport {
  const normalization = createNormalizationReport(campaign);
  return {
    ...normalization,
    entries: [...normalization.entries, ...plannedEntries].sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.entityKind.localeCompare(right.entityKind) ||
        left.source.sheet.localeCompare(right.source.sheet, "pl-PL") ||
        left.source.row - right.source.row ||
        left.reasonCode.localeCompare(right.reasonCode),
    ),
  };
}

function stateDigest(state: CampaignImportState): string {
  return createHash("sha256").update(JSON.stringify(state), "utf8").digest("hex");
}

function importReason(plan: CampaignImportPlan): string {
  const counts = Object.fromEntries(
    ["inserted", "matched", "skipped", "ambiguous", "conflicts"].map((category) => [
      category,
      plan.report.entries.filter((entry) => entry.category === category).length,
    ]),
  );
  return `Profil ${plan.campaign.workbookProfile}; SHA-256 ${plan.campaign.workbookSha256}; inserted=${counts.inserted}; matched=${counts.matched}; skipped=${counts.skipped}; ambiguous=${counts.ambiguous}; conflicts=${counts.conflicts}.`;
}
