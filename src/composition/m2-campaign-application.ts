import { randomUUID } from "node:crypto";

import {
  deserializeCampaignExportWorkbook,
  serializeCampaignExportWorkbook,
} from "../adapters/xlsx/campaign-export-workbook.js";
import { CampaignExportService } from "../application/export/campaign-export-service.js";
import { CampaignImportService } from "../application/import/campaign-import-service.js";
import { CurrentStateImportService } from "../application/import/current-state-import-service.js";
import type { Clock, IdSource } from "../domain/mutations/campaign-mutation.js";
import { CampaignMutationCoordinator } from "../persistence/sqlite/campaign-mutation-coordinator.js";
import { SqliteCampaignExportSource } from "../persistence/sqlite/campaign-export-source.js";
import { SqliteCampaignImportStateReader } from "../persistence/sqlite/campaign-import-state-reader.js";
import { openMigratedSqliteConnection } from "../persistence/sqlite/migrations.js";

export interface OpenM2CampaignApplicationOptions {
  readonly filename: string;
  readonly clock?: Clock;
  readonly ids?: IdSource;
}

export interface M2CampaignApplication {
  readonly legacyImport: CampaignImportService;
  readonly currentStateImport: CurrentStateImportService;
  readonly campaignExport: CampaignExportService;
  close(): void;
}

export function openM2CampaignApplication(
  options: OpenM2CampaignApplicationOptions,
): M2CampaignApplication {
  const connection = openMigratedSqliteConnection({ filename: options.filename });
  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { nextId: () => randomUUID() };
  const source = new SqliteCampaignExportSource(connection.database);
  const coordinator = new CampaignMutationCoordinator(connection.database, { clock, ids });
  return {
    legacyImport: new CampaignImportService(
      new SqliteCampaignImportStateReader(connection.database),
      coordinator,
      ids,
    ),
    currentStateImport: new CurrentStateImportService(source, coordinator),
    campaignExport: new CampaignExportService(source, clock, {
      serialize: serializeCampaignExportWorkbook,
      deserialize: deserializeCampaignExportWorkbook,
    }),
    close: () => connection.close(),
  };
}
