import { CampaignReadToolService } from "../application/tools/campaign-read-tools.js";
import { CampaignValidationService } from "../application/inspection/campaign-validation-service.js";
import { SqliteCampaignInspectionReadPort } from "../persistence/sqlite/campaign-inspection-read-port.js";
import { SqliteCampaignValidationReadPort } from "../persistence/sqlite/campaign-validation-read-port.js";
import { openReadOnlySqliteConnection } from "../persistence/sqlite/read-only-connection.js";
import { assertLatestCampaignSchema } from "../persistence/sqlite/schema-compatibility.js";
import {
  createReadToolRegistry,
  type ReadToolRegistry,
} from "../tools/registry/read-tool-registry.js";

export interface OpenM4CampaignApplicationOptions {
  readonly filename: string;
}
export interface M4CampaignApplication {
  readonly readTools: ReadToolRegistry;
  close(): void;
}

export function openM4CampaignApplication(
  options: OpenM4CampaignApplicationOptions,
): M4CampaignApplication {
  const connection = openReadOnlySqliteConnection(options.filename);
  try {
    assertLatestCampaignSchema(connection.database);
    const inspection = new SqliteCampaignInspectionReadPort(connection.database);
    const validation = new CampaignValidationService(
      new SqliteCampaignValidationReadPort(connection.database),
    );
    return Object.freeze({
      readTools: createReadToolRegistry(new CampaignReadToolService(inspection, validation)),
      close: () => connection.close(),
    });
  } catch (error: unknown) {
    try {
      connection.close();
    } catch {
      /* preserve setup failure */
    }
    throw error;
  }
}
