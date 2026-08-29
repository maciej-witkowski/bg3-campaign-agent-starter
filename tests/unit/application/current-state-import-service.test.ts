import { count } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCampaignExport } from "../../../src/application/export/campaign-export.js";
import { CurrentStateImportService } from "../../../src/application/import/current-state-import-service.js";
import { CampaignMutationCoordinator } from "../../../src/persistence/sqlite/campaign-mutation-coordinator.js";
import { SqliteCampaignExportSource } from "../../../src/persistence/sqlite/campaign-export-source.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { changeEvents, characters } from "../../../src/persistence/sqlite/schema.js";

const instant = new Date("2026-08-29T12:00:00.000Z");
let sourceConnection: SqliteConnection;
let targetConnection: SqliteConnection;

beforeEach(() => {
  sourceConnection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
  targetConnection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => {
  sourceConnection.close();
  targetConnection.close();
});

describe("current-state import service", () => {
  it("preserves IDs in a fresh database and becomes an audited no-op on repeat", () => {
    sourceConnection.database
      .insert(characters)
      .values({
        id: "character-stable-id",
        canonicalName: "GALE",
        displayNamePl: "Gale",
        racePl: "Człowiek",
        classPl: "Czarodziej",
        subclassPl: null,
        level: 7,
        roleSummary: "Kontrola pola walki",
        activeParty: true,
        notes: null,
        createdAt: instant.toISOString(),
        updatedAt: instant.toISOString(),
      })
      .run();
    const campaignExport = createCampaignExport(
      new SqliteCampaignExportSource(sourceConnection.database).captureCurrentState(instant),
    );
    const service = serviceFor(targetConnection);

    expect(service.applyImport(service.planImport(campaignExport)).changed).toBe(true);
    expect(targetConnection.database.select({ id: characters.id }).from(characters).get()?.id).toBe(
      "character-stable-id",
    );
    expect(service.applyImport(service.planImport(campaignExport)).changed).toBe(false);
    expect(eventCount(targetConnection)).toBe(1);
  });

  it("blocks import into a different non-empty campaign", () => {
    targetConnection.database
      .insert(characters)
      .values({
        id: "existing",
        canonicalName: "EXISTING",
        displayNamePl: "Istniejąca",
        racePl: null,
        classPl: "Łotrzyca",
        subclassPl: null,
        level: 1,
        roleSummary: "Test",
        activeParty: true,
        notes: null,
        createdAt: instant.toISOString(),
        updatedAt: instant.toISOString(),
      })
      .run();
    const emptyExport = createCampaignExport(
      new SqliteCampaignExportSource(sourceConnection.database).captureCurrentState(instant),
    );
    const service = serviceFor(targetConnection);
    const plan = service.planImport(emptyExport);

    expect(plan.blocked).toBe(true);
    expect(() => service.applyImport(plan)).toThrow(/pustej albo identycznej/u);
    expect(eventCount(targetConnection)).toBe(0);
  });

  it("rejects a copied current-state import plan", () => {
    const campaignExport = createCampaignExport(
      new SqliteCampaignExportSource(sourceConnection.database).captureCurrentState(instant),
    );
    const service = serviceFor(targetConnection);
    const plan = service.planImport(campaignExport);

    expect(() => service.applyImport({ ...plan })).toThrow(/nie został wydany/u);
    expect(eventCount(targetConnection)).toBe(0);
  });
});

function serviceFor(connection: SqliteConnection): CurrentStateImportService {
  let next = 0;
  const ids = { nextId: () => `event-${++next}` };
  const coordinator = new CampaignMutationCoordinator(connection.database, {
    clock: { now: () => instant },
    ids,
  });
  return new CurrentStateImportService(
    new SqliteCampaignExportSource(connection.database),
    coordinator,
  );
}

function eventCount(connection: SqliteConnection): number {
  return connection.database.select({ value: count() }).from(changeEvents).get()?.value ?? 0;
}
