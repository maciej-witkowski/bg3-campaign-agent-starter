export {
  EnvironmentConfigurationError,
  environmentSchema,
  loadEnvironment,
  parseEnvironment,
} from "./config/environment.js";
export type { Environment } from "./config/environment.js";

export {
  CAMPAIGN_XLSX_FORMAT,
  CAMPAIGN_XLSX_METADATA_SHEET,
  CAMPAIGN_XLSX_VERSION,
  CampaignExportWorkbookError,
  deserializeCampaignExportWorkbook,
  serializeCampaignExportWorkbook,
} from "./adapters/xlsx/campaign-export-workbook.js";
export {
  DEFAULT_LEGACY_WORKBOOK_LIMITS,
  LegacyTrackerWorkbookError,
  parseLegacyTrackerWorkbook,
} from "./adapters/xlsx/legacy-tracker-workbook.js";
export {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  CampaignExportError,
  createCampaignExport,
  deserializeCampaignExport,
  serializeCampaignExport,
} from "./application/export/campaign-export.js";
export type { CampaignExportV1 } from "./application/export/campaign-export.js";
export { CampaignExportService } from "./application/export/campaign-export-service.js";
export type {
  CampaignExportSourcePort,
  CampaignXlsxCodec,
  ExportClock,
} from "./application/export/campaign-export-service.js";
export { CampaignImportService } from "./application/import/campaign-import-service.js";
export type {
  CampaignImportApplyResult,
  CampaignImportPlan,
} from "./application/import/campaign-import-service.js";
export { renderCampaignStateReport } from "./application/import/campaign-state-report.js";
export type { CampaignImportEvidence } from "./application/import/campaign-state-report.js";
export { CurrentStateImportService } from "./application/import/current-state-import-service.js";
export type { CurrentStateImportPlan } from "./application/import/current-state-import-service.js";
export {
  serializeImportReconciliation,
  serializeImportReport,
  writeImportReconciliation,
  writeImportReport,
} from "./application/import/import-artifacts.js";
export {
  parseImportReconciliation,
  parseImportReport,
} from "./application/import/import-contracts.js";
export type {
  ImportReconciliation,
  ImportReport,
  ImportReportEntry,
} from "./application/import/import-contracts.js";
export { normalizeLegacyCampaign } from "./application/import/legacy-campaign-normalizer.js";
export { openM2CampaignApplication } from "./composition/m2-campaign-application.js";
export type {
  M2CampaignApplication,
  OpenM2CampaignApplicationOptions,
} from "./composition/m2-campaign-application.js";

export {
  CampaignInspectionError,
  DEFAULT_CHANGE_LIMIT,
  MAX_CHANGE_LIMIT,
} from "./application/inspection/campaign-inspection.js";
export type {
  CampaignInspectionErrorCode,
  ChangeSummaryView,
  ChangesView,
  CharacterAbilityView,
  CharacterIdentityView,
  CharacterSpellView,
  CharacterView,
  EffectiveAttributeView,
  EquipmentItemView,
  EquipmentView,
  IllithidPowerView,
  IllithidView,
  InventoryFilters,
  InventoryItemView,
  InventoryView,
  PartyCharacterView,
  PartyView,
  SpellsView,
} from "./application/inspection/campaign-inspection.js";
export { CampaignInspectionService } from "./application/inspection/campaign-inspection-service.js";
export { CampaignValidationService } from "./application/inspection/campaign-validation-service.js";
export type { CampaignValidationResult } from "./application/inspection/campaign-validation-service.js";
export { openM3CampaignApplication } from "./composition/m3-campaign-application.js";
export type {
  M3CampaignApplication,
  OpenM3CampaignApplicationOptions,
} from "./composition/m3-campaign-application.js";
