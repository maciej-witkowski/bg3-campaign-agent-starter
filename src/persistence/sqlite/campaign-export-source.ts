import type { CampaignExportSourcePort } from "../../application/export/campaign-export-service.js";
import type { SqliteDatabase } from "./connection.js";
import { createSqliteCampaignSnapshotPort } from "./campaign-snapshot.js";

export class SqliteCampaignExportSource implements CampaignExportSourcePort {
  public constructor(private readonly database: SqliteDatabase) {}

  public captureCurrentState(capturedAt: Date): string {
    return this.database.transaction((transaction) =>
      createSqliteCampaignSnapshotPort(transaction, capturedAt).capture(),
    );
  }
}
