import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { SqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { SqliteCampaignValidationReadPort } from "../../../src/persistence/sqlite/campaign-validation-read-port.js";

const connections: SqliteConnection[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const connection of connections.splice(0)) connection.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteCampaignValidationReadPort", () => {
  it("keeps all validation reads on one SQLite snapshot", () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-validation-read-"));
    temporaryDirectories.push(directory);
    const filename = join(directory, "campaign.sqlite");
    const reader = openMigratedSqliteConnection({ filename });
    reader.database.$client.pragma("journal_mode = WAL");
    const writer = openMigratedSqliteConnection({ filename });
    connections.push(reader, writer);
    const port = new SqliteCampaignValidationReadPort(reader.database);

    const observed = port.read((state) => {
      const before = state.listAllInventoryItems();
      writer.database.$client
        .prepare(
          "insert into item_definitions (id, name_pl, normalized_name_pl, name_en, type_pl, slot, rarity_pl, description_pl, verification_status, verification_confidence, verification_source, fingerprint, notes) values ('definition-1', 'Próba', 'próba', null, null, null, null, null, 'VERIFIED', null, null, null, null)",
        )
        .run();
      writer.database.$client
        .prepare(
          "insert into inventory_items (id, item_definition_id, status, owner_character_id, quantity, obtained_at, obtained_location, notes) values ('inventory-1', 'definition-1', 'CHEST', null, 1, null, null, null)",
        )
        .run();
      const afterConcurrentCommit = state.listAllInventoryItems();
      return { before, afterConcurrentCommit };
    });

    expect(observed.before).toEqual([]);
    expect(observed.afterConcurrentCommit).toEqual([]);
    expect(port.read((state) => state.listAllInventoryItems())).toHaveLength(1);
  });
});
