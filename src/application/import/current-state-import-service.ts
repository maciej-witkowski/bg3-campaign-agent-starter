import type { CampaignExportSourcePort } from "../export/campaign-export-service.js";
import {
  createCampaignExport,
  normalizeCampaignExport,
  type CampaignExportV1,
} from "../export/campaign-export.js";
import {
  CampaignDomainError,
  type CampaignMutationCoordinatorPort,
  type CampaignMutationResult,
} from "../../domain/mutations/campaign-mutation.js";
import type { CampaignImportState } from "./campaign-import-state.js";

export interface CurrentStateImportPlan {
  readonly campaignExport: CampaignExportV1;
  readonly currentStateSha256: string;
  readonly changed: boolean;
  readonly blocked: boolean;
}

export class CurrentStateImportService {
  public constructor(
    private readonly source: CampaignExportSourcePort,
    private readonly coordinator: CampaignMutationCoordinatorPort,
  ) {}

  public planImport(value: unknown): CurrentStateImportPlan {
    const campaignExport = normalizeCampaignExport(value);
    const current = currentExport(this.source, campaignExport.exportedAt);
    const currentIsEmpty = Object.values(current.state).every((rows) => rows.length === 0);
    const identical = current.stateSha256 === campaignExport.stateSha256;
    return {
      campaignExport,
      currentStateSha256: current.stateSha256,
      changed: currentIsEmpty && !identical,
      blocked: !currentIsEmpty && !identical,
    };
  }

  public applyImport(plan: CurrentStateImportPlan): CampaignMutationResult {
    if (plan.blocked) {
      throw new CampaignDomainError(
        "Import znormalizowanego eksportu wymaga pustej albo identycznej kampanii.",
      );
    }
    if (!plan.changed) {
      this.assertCurrentState(plan);
      return { changed: false };
    }

    const state = exportToDomainState(plan.campaignExport);
    return this.coordinator.execute(
      {
        type: "CURRENT_STATE_IMPORTED",
        summaryPl: "Zaimportowano znormalizowany eksport stanu kampanii.",
        reasonPl: `Format ${plan.campaignExport.format} v${plan.campaignExport.version}; SHA-256 ${plan.campaignExport.stateSha256}.`,
      },
      (writes) => {
        for (const row of state.characters) writes.insertCharacter(row);
        for (const row of state.characterAttributes) writes.setCharacterAttribute(row);
        for (const row of state.itemDefinitions) writes.insertItemDefinition(row);
        for (const row of state.itemEffects) writes.insertItemEffect(row);
        for (const row of state.permanentModifiers) writes.insertPermanentModifier(row);
        for (const row of state.inventoryItems) writes.insertInventoryItem(row);
        for (const row of state.equipment) writes.setEquipment(row);
        for (const row of state.spells) writes.insertSpell(row);
        for (const row of state.characterSpells) writes.setCharacterSpell(row);
        for (const row of state.abilities) writes.insertAbility(row);
        for (const row of state.characterAbilities) writes.setCharacterAbility(row);
        for (const row of state.illithidPowers) writes.insertIllithidPower(row);
        for (const row of state.illithidPowerPrerequisites) writes.setIllithidPrerequisite(row);
        for (const row of state.characterIllithidPowers) writes.setCharacterIllithidPower(row);
        return true;
      },
      () => this.assertCurrentState(plan),
    );
  }

  private assertCurrentState(plan: CurrentStateImportPlan): void {
    const current = currentExport(this.source, plan.campaignExport.exportedAt);
    if (current.stateSha256 !== plan.currentStateSha256) {
      throw new CampaignDomainError("Stan kampanii zmienił się od utworzenia planu importu.");
    }
  }
}

function currentExport(source: CampaignExportSourcePort, instant: string): CampaignExportV1 {
  return createCampaignExport(source.captureCurrentState(new Date(instant)));
}

function exportToDomainState(value: CampaignExportV1): CampaignImportState {
  const state = value.state;
  return {
    characters: state.characters.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    })) as unknown as CampaignImportState["characters"],
    characterAttributes:
      state.characterAttributes as unknown as CampaignImportState["characterAttributes"],
    permanentModifiers: state.permanentModifiers.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt as string),
    })) as unknown as CampaignImportState["permanentModifiers"],
    itemDefinitions: state.itemDefinitions as unknown as CampaignImportState["itemDefinitions"],
    itemEffects: state.itemEffects as unknown as CampaignImportState["itemEffects"],
    inventoryItems: state.inventoryItems.map((row) => ({
      ...row,
      obtainedAt: row.obtainedAt === null ? null : new Date(row.obtainedAt as string),
    })) as unknown as CampaignImportState["inventoryItems"],
    equipment: state.equipment as unknown as CampaignImportState["equipment"],
    spells: state.spells as unknown as CampaignImportState["spells"],
    characterSpells: state.characterSpells as unknown as CampaignImportState["characterSpells"],
    abilities: state.abilities as unknown as CampaignImportState["abilities"],
    characterAbilities:
      state.characterAbilities as unknown as CampaignImportState["characterAbilities"],
    illithidPowers: state.illithidPowers as unknown as CampaignImportState["illithidPowers"],
    illithidPowerPrerequisites:
      state.illithidPowerPrerequisites as unknown as CampaignImportState["illithidPowerPrerequisites"],
    characterIllithidPowers: state.characterIllithidPowers.map((row) => ({
      ...row,
      acquiredAt: row.acquiredAt === null ? null : new Date(row.acquiredAt as string),
    })) as unknown as CampaignImportState["characterIllithidPowers"],
  };
}
