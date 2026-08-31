import {
  deserializeCampaignExportWorkbook,
  serializeCampaignExportWorkbook,
} from "../adapters/xlsx/campaign-export-workbook.js";
import { CampaignExportService } from "../application/export/campaign-export-service.js";
import { createCampaignExportTargetPolicy } from "../application/export/campaign-export-target.js";
import { CampaignInspectionService } from "../application/inspection/campaign-inspection-service.js";
import { CampaignValidationService } from "../application/inspection/campaign-validation-service.js";
import { SqliteCampaignExportSource } from "../persistence/sqlite/campaign-export-source.js";
import { SqliteCampaignInspectionReadPort } from "../persistence/sqlite/campaign-inspection-read-port.js";
import { SqliteCampaignValidationReadPort } from "../persistence/sqlite/campaign-validation-read-port.js";
import { openReadOnlySqliteConnection } from "../persistence/sqlite/read-only-connection.js";
import { assertLatestCampaignSchema } from "../persistence/sqlite/schema-compatibility.js";

export interface OpenM3CampaignApplicationOptions {
  readonly filename: string;
  readonly clock?: { now(): Date };
}

export interface M3CampaignApplication {
  readonly inspection: CampaignInspectionService;
  readonly validation: CampaignValidationService;
  readonly campaignExport: CampaignExportService;
  close(): void;
}

export function openM3CampaignApplication(
  options: OpenM3CampaignApplicationOptions,
): M3CampaignApplication {
  const exportTargetPolicy = createCampaignExportTargetPolicy(options.filename);
  const connection = openReadOnlySqliteConnection(options.filename);
  try {
    assertLatestCampaignSchema(connection.database);
    const clock = options.clock ?? { now: () => new Date() };
    return {
      inspection: new CampaignInspectionService(
        new SqliteCampaignInspectionReadPort(connection.database),
      ),
      validation: new CampaignValidationService(
        new SqliteCampaignValidationReadPort(connection.database),
      ),
      campaignExport: new CampaignExportService(
        new SqliteCampaignExportSource(connection.database),
        clock,
        {
          serialize: serializeCampaignExportWorkbook,
          deserialize: deserializeCampaignExportWorkbook,
        },
        exportTargetPolicy,
      ),
      close: () => connection.close(),
    };
  } catch (error: unknown) {
    connection.close();
    throw error;
  }
}
