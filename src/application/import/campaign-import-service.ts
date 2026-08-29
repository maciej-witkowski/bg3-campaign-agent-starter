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
import {
  parseImportReconciliation,
  type ImportReconciliation,
  type ImportReport,
  type ImportReportEntry,
} from "./import-contracts.js";
import {
  planningDecisionKey,
  reconciliationIssueIdentity,
  type ImportPlanningDecisions,
} from "./reconciliation-decisions.js";

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
  private readonly issuedPlanDigests = new WeakMap<CampaignImportPlan, string>();

  public constructor(
    private readonly stateReader: CampaignImportStateReadPort,
    private readonly coordinator: CampaignMutationCoordinatorPort,
    private readonly ids: IdSource,
  ) {}

  public planImport(
    campaign: NormalizedLegacyCampaign,
    reconciliationInput?: unknown,
  ): CampaignImportPlan {
    const state = this.stateReader.readImportState();
    const base = createPlans(campaign, state, this.ids);
    const baseReport = mergeReport(campaign, [
      ...base.characters.entries,
      ...base.items.entries,
      ...base.capabilities.entries,
    ]);
    const generatedReconciliation = mergeReconciliation(campaign, baseReport.entries);
    const reconciliation =
      reconciliationInput === undefined
        ? generatedReconciliation
        : validateReconciliation(campaign, generatedReconciliation, reconciliationInput);
    const decisions = createPlanningDecisions(campaign, generatedReconciliation, reconciliation);
    const { characters, items, capabilities } =
      decisions.size === 0 ? base : createPlans(campaign, state, this.ids, decisions);
    const report = mergeReport(campaign, [
      ...characters.entries,
      ...items.entries,
      ...capabilities.entries,
    ]);
    assertPlanningDecisionsApplied(campaign, reconciliation, report.entries);
    const plan: CampaignImportPlan = {
      campaign,
      stateSha256: stateDigest(state),
      characters,
      items,
      capabilities,
      report,
      reconciliation,
      blocked: characters.blocked || items.blocked || capabilities.blocked,
    };
    this.issuedPlanDigests.set(plan, importPlanDigest(plan));
    return plan;
  }

  public applyImport(plan: CampaignImportPlan): CampaignImportApplyResult {
    this.assertIssuedPlan(plan);
    if (plan.blocked)
      throw new CampaignDomainError("Plan importu zawiera konflikty blokujące zapis kampanii.");
    if (!hasWrites(plan)) {
      this.assertCurrentState(plan.stateSha256);
      return { changed: false, report: plan.report };
    }

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
      () => this.assertCurrentState(plan.stateSha256),
    );
    return { ...result, report: plan.report };
  }

  private assertCurrentState(expectedSha256: string): void {
    if (stateDigest(this.stateReader.readImportState()) !== expectedSha256)
      throw new CampaignDomainError("Stan kampanii zmienił się od utworzenia planu importu.");
  }

  private assertIssuedPlan(plan: CampaignImportPlan): void {
    const expectedDigest = this.issuedPlanDigests.get(plan);
    if (expectedDigest === undefined || expectedDigest !== importPlanDigest(plan))
      throw new CampaignDomainError(
        "Plan importu nie został wydany przez tę usługę albo został zmodyfikowany.",
      );
  }
}

function importPlanDigest(plan: CampaignImportPlan): string {
  return createHash("sha256")
    .update(
      JSON.stringify(plan, (_key, value: unknown) =>
        value instanceof Map ? [...value.entries()] : value,
      ),
      "utf8",
    )
    .digest("hex");
}

function createPlans(
  campaign: NormalizedLegacyCampaign,
  state: CampaignImportState,
  ids: IdSource,
  decisions?: ImportPlanningDecisions,
): Pick<CampaignImportPlan, "characters" | "items" | "capabilities"> {
  const characters = planLegacyCharacterImport(campaign, state, ids, decisions);
  const items = planLegacyItemImport(campaign, state, characters, ids, decisions);
  const capabilities = planLegacyCapabilityImport(campaign, state, characters, ids, decisions);
  return { characters, items, capabilities };
}

function validateReconciliation(
  campaign: NormalizedLegacyCampaign,
  generated: ImportReconciliation,
  input: unknown,
): ImportReconciliation {
  const reconciliation = parseImportReconciliation(input);
  if (
    reconciliation.workbookProfile !== campaign.workbookProfile ||
    reconciliation.workbookSha256 !== campaign.workbookSha256
  )
    throw new CampaignDomainError(
      "Dokument rekonsyliacji nie dotyczy tego profilu i skrótu skoroszytu.",
    );

  const expected = new Map(
    [...(campaign.appliedReconciliationIssues ?? []), ...generated.issues].map((issue) => [
      issue.issueId,
      issue,
    ]),
  );
  if (reconciliation.issues.length !== expected.size)
    throw new CampaignDomainError("Dokument rekonsyliacji ma niepełny lub obcy zestaw problemów.");
  for (const issue of reconciliation.issues) {
    const expectedIssue = expected.get(issue.issueId);
    if (
      expectedIssue === undefined ||
      reconciliationIssueIdentity(issue) !== reconciliationIssueIdentity(expectedIssue)
    )
      throw new CampaignDomainError(
        "Problem rekonsyliacji nie odpowiada bieżącemu planowi importu.",
      );
  }
  return reconciliation;
}

function createPlanningDecisions(
  campaign: NormalizedLegacyCampaign,
  generated: ImportReconciliation,
  reconciliation: ImportReconciliation,
): Map<string, NonNullable<ImportReconciliation["issues"][number]["resolution"]>> {
  const normalizationIssueIds = new Set([
    ...campaign.issues.map((issue) => issue.issueId),
    ...(campaign.appliedReconciliationIssues ?? []).map((issue) => issue.issueId),
  ]);
  const generatedIds = new Set(generated.issues.map((issue) => issue.issueId));
  const decisions = new Map<
    string,
    NonNullable<ImportReconciliation["issues"][number]["resolution"]>
  >();
  for (const issue of reconciliation.issues) {
    if (issue.resolution === null || normalizationIssueIds.has(issue.issueId)) continue;
    if (!generatedIds.has(issue.issueId))
      throw new CampaignDomainError("Decyzja rekonsyliacji nie dotyczy bieżącego planu.");
    if (
      issue.resolution.action === "provide_canonical_value" ||
      issue.resolution.action === "attest_verified_alias"
    )
      throw new CampaignDomainError(
        `Akcja ${issue.resolution.action} nie może rozstrzygnąć konfliktu planowania.`,
      );
    decisions.set(
      planningDecisionKey(issue.entityKind, issue.source, issue.reasonCode),
      issue.resolution,
    );
  }
  return decisions;
}

function assertPlanningDecisionsApplied(
  campaign: NormalizedLegacyCampaign,
  reconciliation: ImportReconciliation,
  entries: readonly ImportReportEntry[],
): void {
  const normalizationIssueIds = new Set([
    ...campaign.issues.map((issue) => issue.issueId),
    ...(campaign.appliedReconciliationIssues ?? []).map((issue) => issue.issueId),
  ]);
  for (const issue of reconciliation.issues) {
    if (issue.resolution === null || normalizationIssueIds.has(issue.issueId)) continue;
    const unresolved = entries.some(
      (entry) =>
        (entry.category === "ambiguous" || entry.category === "conflicts") &&
        planningDecisionKey(entry.entityKind, entry.source, entry.reasonCode) ===
          planningDecisionKey(issue.entityKind, issue.source, issue.reasonCode),
    );
    if (unresolved)
      throw new CampaignDomainError(
        `Akcja ${issue.resolution.action} nie rozstrzyga problemu ${issue.reasonCode}.`,
      );
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
