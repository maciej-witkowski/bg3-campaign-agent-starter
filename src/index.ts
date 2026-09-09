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
export type {
  CampaignValidationReadPort,
  CampaignValidationResult,
} from "./application/inspection/campaign-validation-service.js";
export { openM3CampaignApplication } from "./composition/m3-campaign-application.js";
export type {
  M3CampaignApplication,
  OpenM3CampaignApplicationOptions,
} from "./composition/m3-campaign-application.js";

export { CLI_RESULT_FORMAT, CLI_RESULT_VERSION, CliUsageError } from "./cli/cli-contract.js";
export type {
  CliCommand,
  CliCommandName,
  CliCommandRequest,
  CliEnvelope,
  CliErrorPayload,
  CliFailureEnvelope,
  CliProcessResult,
  CliRequest,
  CliSuccessEnvelope,
  CliUsageErrorCode,
} from "./cli/cli-contract.js";
export { cliFailure, cliSuccess, serializeCliEnvelope } from "./cli/cli-envelope.js";
export { parseCliArguments } from "./cli/parse-cli-arguments.js";
export { runCli } from "./cli/run-cli.js";
export type { RunCliOptions } from "./cli/run-cli.js";

export {
  CampaignReadToolService,
  CampaignToolQueryError,
} from "./application/tools/campaign-read-tools.js";
export type { CampaignReadToolPort } from "./application/tools/campaign-read-tools.js";
export { openM4CampaignApplication } from "./composition/m4-campaign-application.js";
export type {
  M4CampaignApplication,
  OpenM4CampaignApplicationOptions,
} from "./composition/m4-campaign-application.js";

export * from "./tools/contracts/index.js";
export {
  READ_TOOL_CATALOG,
  assertValidReadToolCatalog,
} from "./tools/catalog/read-tool-catalog.js";
export type {
  ReadToolCategory,
  ReadToolDefinition,
  ReadToolName,
} from "./tools/catalog/read-tool-catalog.js";
export {
  PROPOSAL_TOOL_CATALOG,
  assertValidProposalToolCatalog,
} from "./tools/catalog/proposal-tool-catalog.js";
export type {
  ProposalToolDefinition,
  ProposalToolName,
} from "./tools/catalog/proposal-tool-catalog.js";
export {
  MUTATION_TOOL_CATALOG,
  MUTATION_TOOL_NAMES,
  assertValidMutationToolCatalog,
} from "./tools/catalog/mutation-tool-catalog.js";
export type {
  MutationToolDefinition,
  MutationToolName,
} from "./tools/catalog/mutation-tool-catalog.js";
export {
  canonicalJsonDigest,
  mutationAuthorizationClaim,
} from "./tools/authorization/mutation-authorization.js";
export type {
  MutationAuthorizationClaim,
  MutationAuthorizationDecision,
  MutationAuthorizationPort,
  MutationAuthorizationRequest,
} from "./tools/authorization/mutation-authorization.js";
export { createReadToolRegistry } from "./tools/registry/read-tool-registry.js";
export type {
  ReadToolRegistry,
  ReadToolRegistryOptions,
  ReadToolRunner,
} from "./tools/registry/read-tool-registry.js";
export { createProposalToolRegistry } from "./tools/registry/proposal-tool-registry.js";
export type {
  ProposalToolHandler,
  ProposalToolRegistry,
} from "./tools/registry/proposal-tool-registry.js";
export { createMutationToolRegistry } from "./tools/registry/mutation-tool-registry.js";
export type {
  MutationToolHandlers,
  MutationToolInputByName,
  MutationToolRegistry,
} from "./tools/registry/mutation-tool-registry.js";
export { executeTool } from "./tools/execution/tool-executor.js";
export type {
  ExecutableToolDefinition,
  ExecuteToolOptions,
  ToolBeforeInvokeContext,
  ToolExecutionObservation,
  ToolExecutionObserver,
  ToolExecutionStage,
} from "./tools/execution/tool-executor.js";
export { ExpectedToolError, SHARED_TOOL_ERROR_CODES } from "./tools/execution/tool-errors.js";
export type {
  SafeToolError,
  SharedToolErrorCode,
  ToolErrorMapper,
} from "./tools/execution/tool-errors.js";
export { toolFailure, toolSuccess } from "./tools/execution/tool-result.js";
