import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";

const EXPECTED_TABLES = [
  "abilities",
  "change_events",
  "character_abilities",
  "character_attributes",
  "character_illithid_powers",
  "character_spells",
  "characters",
  "checkpoints",
  "equipment",
  "illithid_power_prerequisites",
  "illithid_powers",
  "inventory_items",
  "item_definitions",
  "item_effects",
  "permanent_modifiers",
  "spells",
];

let connection: SqliteConnection;

const characterSql = (id: string, canonicalName: string) =>
  `insert into characters values ('${id}', '${canonicalName}', 'Łotrzyk', null, 'Łotrzyk', null, 1, 'Wsparcie', 1, null, '2026-08-26T12:00:00.000Z', '2026-08-26T12:00:00.000Z')`;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => {
  connection?.close();
});

describe("M1 relational migration", () => {
  it("migrates an empty database to exactly the M1 tables with valid foreign keys", () => {
    const rows = connection.database.$client
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name <> '__drizzle_migrations' order by name",
      )
      .all() as { name: string }[];

    expect(rows.map(({ name }) => name)).toEqual(EXPECTED_TABLES);
    expect(connection.database.$client.prepare("pragma foreign_key_check").all()).toEqual([]);
    expect(rows.map(({ name }) => name)).not.toContain("merchant_sessions");
    expect(rows.map(({ name }) => name)).not.toContain("proposals");
    expect(rows.map(({ name }) => name)).not.toContain("item_aliases");
    const triggers = connection.database.$client
      .prepare("select name from sqlite_master where type = 'trigger' order by name")
      .all() as { name: string }[];
    expect(triggers.map(({ name }) => name)).toEqual([
      "change_events_block_delete",
      "change_events_block_update",
    ]);

    const changeEventColumns = connection.database.$client
      .prepare("pragma table_info(change_events)")
      .all() as { name: string }[];
    expect(changeEventColumns.map(({ name }) => name)).toContain("checkpoint_id");
    const changeEventForeignKeys = connection.database.$client
      .prepare("pragma foreign_key_list(change_events)")
      .all() as { from: string; table: string; on_delete: string }[];
    expect(changeEventForeignKeys).toContainEqual(
      expect.objectContaining({
        from: "checkpoint_id",
        table: "checkpoints",
        on_delete: "RESTRICT",
      }),
    );
    const changeEventIndexes = connection.database.$client
      .prepare("pragma index_list(change_events)")
      .all() as { name: string }[];
    expect(changeEventIndexes.map(({ name }) => name)).toContain("change_events_checkpoint_idx");
  });

  it("enforces local identity, enum, boolean, quantity, provenance and foreign-key facts", () => {
    const client = connection.database.$client;
    client.exec(characterSql("character-1", "astarion"));

    expect(() => client.exec(characterSql("character-2", "astarion"))).toThrow();
    expect(() =>
      client.exec(characterSql("character-3", "bad-bool").replace(", 1, null,", ", 7, null,")),
    ).toThrow();
    expect(() =>
      client.exec("insert into character_attributes values ('character-1', 'LUCK', 10)"),
    ).toThrow();
    expect(() =>
      client.exec("insert into character_attributes values ('missing', 'STR', 10)"),
    ).toThrow();

    client.exec(
      "insert into item_definitions (id,name_pl,normalized_name_pl,verification_status) values ('item-1','Hełm','hełm','UNKNOWN')",
    );
    expect(() =>
      client.exec(
        "insert into inventory_items (id,item_definition_id,status,quantity) values ('inventory-1','item-1','CHEST',0)",
      ),
    ).toThrow();
    expect(() =>
      client.exec(
        "insert into permanent_modifiers values ('modifier-1','character-1','ATTRIBUTE','STR',2,'  ',null,'GAME_UI',1,1,null,'2026-08-26T12:00:00.000Z')",
      ),
    ).toThrow();
  });

  it("enforces one instance per equipment row, one item per character slot and unique joins", () => {
    const client = connection.database.$client;
    client.exec(characterSql("character-1", "laezel"));
    client.exec(
      "insert into item_definitions (id,name_pl,normalized_name_pl,verification_status) values ('item-1','Pierścień','pierścień','VERIFIED')",
    );
    client.exec(
      "insert into inventory_items (id,item_definition_id,status,quantity) values ('inventory-1','item-1','EQUIPPED',1),('inventory-2','item-1','EQUIPPED',1)",
    );
    client.exec("insert into equipment values ('inventory-1','character-1','RING_1')");

    expect(() =>
      client.exec("insert into equipment values ('inventory-1','character-1','RING_2')"),
    ).toThrow();
    expect(() =>
      client.exec("insert into equipment values ('inventory-2','character-1','RING_1')"),
    ).toThrow();

    client.exec(
      "insert into spells (id,name_pl,normalized_name_pl,level,verification_status) values ('spell-1','Światło','światło',0,'VERIFIED')",
    );
    client.exec("insert into character_spells values ('character-1','spell-1','CLASS',1,0,0,null)");
    expect(() =>
      client.exec(
        "insert into character_spells values ('character-1','spell-1','CLASS',1,0,0,null)",
      ),
    ).toThrow();
  });
});
