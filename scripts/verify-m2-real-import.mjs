import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { TextDecoder, TextEncoder } from "node:util";

import { count, sql } from "drizzle-orm";

import {
  deserializeCampaignExportWorkbook,
  serializeCampaignExportWorkbook,
} from "../dist/adapters/xlsx/campaign-export-workbook.js";
import { parseLegacyTrackerWorkbook } from "../dist/adapters/xlsx/legacy-tracker-workbook.js";
import { writeVerifiedArtifact } from "../dist/application/export/atomic-artifact-writer.js";
import { CampaignExportService } from "../dist/application/export/campaign-export-service.js";
import { deserializeCampaignExport } from "../dist/application/export/campaign-export.js";
import { CampaignImportService } from "../dist/application/import/campaign-import-service.js";
import { renderCampaignStateReport } from "../dist/application/import/campaign-state-report.js";
import { CurrentStateImportService } from "../dist/application/import/current-state-import-service.js";
import {
  writeImportReconciliation,
  writeImportReport,
} from "../dist/application/import/import-artifacts.js";
import { normalizeLegacyCampaign } from "../dist/application/import/legacy-campaign-normalizer.js";
import { CampaignMutationCoordinator } from "../dist/persistence/sqlite/campaign-mutation-coordinator.js";
import { SqliteCampaignExportSource } from "../dist/persistence/sqlite/campaign-export-source.js";
import { SqliteCampaignImportStateReader } from "../dist/persistence/sqlite/campaign-import-state-reader.js";
import { openMigratedSqliteConnection } from "../dist/persistence/sqlite/migrations.js";
import { changeEvents } from "../dist/persistence/sqlite/schema.js";

const [sourceArg, outputPrefixArg] = process.argv.slice(2);
if (sourceArg === undefined || outputPrefixArg === undefined) {
  throw new Error("Usage: node scripts/verify-m2-real-import.mjs <tracker.xlsx> <output-prefix>");
}

const sourcePath = resolve(sourceArg);
const outputPrefix = resolve(outputPrefixArg);
const paths = {
  database: `${outputPrefix}.sqlite3`,
  reportJson: `${outputPrefix}-import-report.json`,
  reconciliation: `${outputPrefix}-reconciliation.json`,
  exportJson: `${outputPrefix}-state.json`,
  exportXlsx: `${outputPrefix}-state.xlsx`,
  review: `${outputPrefix}-database-review.md`,
  jsonRoundTrip: `${outputPrefix}-roundtrip-json.sqlite3`,
  xlsxRoundTrip: `${outputPrefix}-roundtrip-xlsx.sqlite3`,
};
for (const path of Object.values(paths)) await assertMissing(path);

const occurredAt = new Date();
const ids = { nextId: () => randomUUID() };
const connection = openMigratedSqliteConnection({ filename: paths.database });
let plan;
let first;
let second;
let campaignExport;
try {
  const stage = await parseLegacyTrackerWorkbook(sourcePath);
  const campaign = normalizeLegacyCampaign(stage);
  const coordinator = new CampaignMutationCoordinator(connection.database, {
    clock: { now: () => occurredAt },
    ids,
  });
  const service = new CampaignImportService(
    new SqliteCampaignImportStateReader(connection.database),
    coordinator,
    ids,
  );
  plan = service.planImport(campaign);
  first = service.applyImport(plan);
  second = service.applyImport(service.planImport(campaign));

  await writeImportReport(paths.reportJson, first.report);
  await writeImportReconciliation(paths.reconciliation, plan.reconciliation);
  const exportService = new CampaignExportService(
    new SqliteCampaignExportSource(connection.database),
    { now: () => occurredAt },
    {
      serialize: serializeCampaignExportWorkbook,
      deserialize: deserializeCampaignExportWorkbook,
    },
  );
  campaignExport = await exportService.writeJson(paths.exportJson);
  const xlsxExport = await exportService.writeXlsx(paths.exportXlsx);
  if (xlsxExport.stateSha256 !== campaignExport.stateSha256) {
    throw new Error("JSON and XLSX captures differ.");
  }

  await verifyRoundTrip(
    paths.jsonRoundTrip,
    deserializeCampaignExport(await readFile(paths.exportJson, "utf8")),
    campaignExport.stateSha256,
    occurredAt,
  );
  await verifyRoundTrip(
    paths.xlsxRoundTrip,
    await deserializeCampaignExportWorkbook(await readFile(paths.exportXlsx)),
    campaignExport.stateSha256,
    occurredAt,
  );

  const integrity = connection.database.get(sql`pragma integrity_check`);
  const foreignKeyViolations = connection.database.all(sql`pragma foreign_key_check`);
  const auditEventCount =
    connection.database.select({ value: count() }).from(changeEvents).get()?.value ?? 0;
  const markdown = renderCampaignStateReport(campaignExport, first.report, {
    databasePath: paths.database,
    firstImportChanged: first.changed,
    secondImportChanged: second.changed,
    auditEventCount,
    integrityCheck: String(integrity?.integrity_check ?? "unknown"),
    foreignKeyViolationCount: foreignKeyViolations.length,
  });
  await writeVerifiedArtifact(paths.review, new TextEncoder().encode(markdown), (bytes) => {
    if (!new TextDecoder().decode(bytes).startsWith("# Raport faktycznego importu")) {
      throw new Error("Invalid review report.");
    }
  });
} finally {
  connection.close();
}

process.stdout.write(
  `${JSON.stringify(
    {
      paths,
      firstImportChanged: first.changed,
      secondImportChanged: second.changed,
      stateSha256: campaignExport.stateSha256,
      reportEntries: plan.report.entries.length,
      reconciliationIssues: plan.reconciliation.issues.length,
    },
    null,
    2,
  )}\n`,
);

async function verifyRoundTrip(filename, campaignExport, expectedDigest, instant) {
  const roundTrip = openMigratedSqliteConnection({ filename });
  try {
    const ids = { nextId: () => randomUUID() };
    const coordinator = new CampaignMutationCoordinator(roundTrip.database, {
      clock: { now: () => instant },
      ids,
    });
    const service = new CurrentStateImportService(
      new SqliteCampaignExportSource(roundTrip.database),
      coordinator,
    );
    const first = service.applyImport(service.planImport(campaignExport));
    const second = service.applyImport(service.planImport(campaignExport));
    const actual = new SqliteCampaignExportSource(roundTrip.database).captureCurrentState(instant);
    const actualExport = new CampaignExportService(
      new SqliteCampaignExportSource(roundTrip.database),
      { now: () => instant },
      {
        serialize: serializeCampaignExportWorkbook,
        deserialize: deserializeCampaignExportWorkbook,
      },
    ).capture();
    if (
      !first.changed ||
      second.changed ||
      actual.length === 0 ||
      actualExport.stateSha256 !== expectedDigest
    ) {
      throw new Error(`Round-trip verification failed: ${filename}`);
    }
  } finally {
    roundTrip.close();
  }
}

async function assertMissing(path) {
  try {
    await access(path);
    throw new Error(`Refusing to overwrite existing artifact: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
