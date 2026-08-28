import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteCampaignImportStateReader } from "../../../src/persistence/sqlite/campaign-import-state-reader.js";
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

let connection: SqliteConnection;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => connection.close());

describe("SQLite campaign import state reader", () => {
  it("returns an empty typed state for a clean campaign", () => {
    const state = new SqliteCampaignImportStateReader(connection.database).readImportState();
    expect(Object.values(state).every((collection) => collection.length === 0)).toBe(true);
  });

  it("returns deterministic domain values needed by import matching", () => {
    const db = connection.database;
    db.insert(characters)
      .values({
        id: "character-1",
        canonicalName: "LAEZEL",
        displayNamePl: "Lae'zel",
        racePl: "Githyanki",
        classPl: "Wojownik",
        subclassPl: "Mistrz Bitew",
        level: 9,
        roleSummary: "Frontliner",
        activeParty: true,
        notes: null,
        createdAt: "2026-08-29T10:00:00.000Z",
        updatedAt: "2026-08-29T10:00:00.000Z",
      })
      .run();
    db.insert(itemDefinitions)
      .values({
        id: "definition-1",
        namePl: "Miecz Astralnej Równiny",
        normalizedNamePl: "miecz astralnej równiny",
        nameEn: null,
        typePl: "Broń",
        slot: "MAIN_HAND",
        rarityPl: null,
        descriptionPl: null,
        verificationStatus: "VERIFIED",
        verificationConfidence: null,
        verificationSource: "POTWIERDZONE W GRZE",
        fingerprint: "import-v1:test",
        notes: null,
      })
      .run();
    db.insert(inventoryItems)
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

    const state = new SqliteCampaignImportStateReader(db).readImportState();
    expect(state.characters[0]).toMatchObject({
      id: "character-1",
      canonicalName: "LAEZEL",
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
    });
    expect(state.itemDefinitions[0]).toMatchObject({
      id: "definition-1",
      fingerprint: "import-v1:test",
    });
    expect(state.inventoryItems[0]).toMatchObject({
      id: "inventory-1",
      ownerCharacterId: "character-1",
      obtainedAt: null,
    });
  });
});
