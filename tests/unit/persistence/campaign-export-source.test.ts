import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CampaignValidationError } from "../../../src/domain/validation/campaign-validation.js";
import { SqliteCampaignExportSource } from "../../../src/persistence/sqlite/campaign-export-source.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import {
  characters,
  inventoryItems,
  itemDefinitions,
} from "../../../src/persistence/sqlite/schema.js";

const instant = "2026-08-29T12:00:00.000Z";
let connection: SqliteConnection;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => connection.close());

describe("SQLite campaign export source", () => {
  it("rejects a cross-row invalid state before capturing an export", () => {
    connection.database
      .insert(characters)
      .values({
        id: "character-1",
        canonicalName: "GALE",
        displayNamePl: "Gale",
        racePl: null,
        classPl: "Mag",
        subclassPl: null,
        level: 9,
        roleSummary: "Kontrola",
        activeParty: true,
        notes: null,
        createdAt: instant,
        updatedAt: instant,
      })
      .run();
    connection.database
      .insert(itemDefinitions)
      .values({
        id: "definition-1",
        namePl: "Kapelusz",
        normalizedNamePl: "kapelusz",
        nameEn: null,
        typePl: null,
        slot: "HEAD",
        rarityPl: null,
        descriptionPl: null,
        verificationStatus: "UNKNOWN",
        verificationConfidence: null,
        verificationSource: null,
        fingerprint: null,
        notes: null,
      })
      .run();
    connection.database
      .insert(inventoryItems)
      .values({
        id: "inventory-1",
        itemDefinitionId: "definition-1",
        status: "EQUIPPED",
        ownerCharacterId: "character-1",
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      })
      .run();

    expect(() =>
      new SqliteCampaignExportSource(connection.database).captureCurrentState(new Date(instant)),
    ).toThrow(CampaignValidationError);
  });
});
