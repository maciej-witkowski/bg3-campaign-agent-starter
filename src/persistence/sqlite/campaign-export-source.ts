import type { CampaignExportSourcePort } from "../../application/export/campaign-export-service.js";
import {
  CampaignValidationError,
  validateCampaignState,
} from "../../domain/validation/campaign-validation.js";
import type { SqliteDatabase } from "./connection.js";
import { createSqliteCampaignSnapshotPort } from "./campaign-snapshot.js";
import { SqliteCampaignValidationStateReader } from "./campaign-validation-state-reader.js";

export class SqliteCampaignExportSource implements CampaignExportSourcePort {
  public constructor(private readonly database: SqliteDatabase) {}

  public captureCurrentState(capturedAt: Date): string {
    return this.database.transaction((transaction) => {
      const violations = validateCampaignState(
        new SqliteCampaignValidationStateReader(transaction),
      );
      if (violations.length > 0) throw new CampaignValidationError(violations);
      return createSqliteCampaignSnapshotPort(transaction, capturedAt).capture();
    });
  }
}
