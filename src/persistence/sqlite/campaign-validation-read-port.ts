import type { CampaignValidationReadPort } from "../../application/inspection/campaign-validation-service.js";
import type { CampaignValidationStateReader } from "../../domain/validation/campaign-validation.js";
import type { SqliteDatabase } from "./connection.js";
import { SqliteCampaignValidationStateReader } from "./campaign-validation-state-reader.js";

export class SqliteCampaignValidationReadPort implements CampaignValidationReadPort {
  public constructor(private readonly database: SqliteDatabase) {}

  public read<T>(operation: (state: CampaignValidationStateReader) => T): T {
    return this.database.transaction((transaction) =>
      operation(new SqliteCampaignValidationStateReader(transaction)),
    );
  }
}
