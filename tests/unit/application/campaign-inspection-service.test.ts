import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CHANGE_LIMIT } from "../../../src/application/inspection/campaign-inspection.js";
import type { CampaignInspectionError } from "../../../src/application/inspection/campaign-inspection.js";
import { CampaignInspectionService } from "../../../src/application/inspection/campaign-inspection-service.js";
import { SqliteCampaignInspectionReadPort } from "../../../src/persistence/sqlite/campaign-inspection-read-port.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { seedM3CampaignFixture } from "../fixtures/m3-campaign-fixture.js";

let connection: SqliteConnection;
let service: CampaignInspectionService;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
  seedM3CampaignFixture(connection.database);
  service = new CampaignInspectionService(
    new SqliteCampaignInspectionReadPort(connection.database),
  );
});
afterEach(() => connection.close());

describe("CampaignInspectionService", () => {
  it("lists the active party in Polish order with derived effective attributes", () => {
    const result = service.getParty();

    expect(result.characters.map((value) => value.displayNamePl)).toEqual(["Astarion", "Lae'zel"]);
    expect(result.characters[1]?.attributes).toEqual([
      { attribute: "STR", baseValue: 17, effectiveValue: 19 },
      { attribute: "DEX", baseValue: 13, effectiveValue: 13 },
    ]);
  });

  it("resolves a normalized Polish display name and returns abilities without other views", () => {
    const result = service.getCharacter("  LAE'ZEL  ");

    expect(result.character.id).toBe("character-laezel");
    expect(result.permanentModifiers.map((value) => value.id)).toEqual([
      "modifier-active",
      "modifier-inactive",
    ]);
    expect(result.abilities[0]?.definition.namePl).toBe("Mistrz Broni Dwuręcznej");
    expect(result).not.toHaveProperty("equipment");
    expect(result).not.toHaveProperty("spells");
  });

  it("uses exact canonical-name precedence and rejects missing or ambiguous display names", () => {
    expect(service.getCharacter("gale").character.id).toBe("character-gale");
    expect(() => service.getCharacter("Nie istnieje")).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "CHARACTER_NOT_FOUND" }),
    );
    expect(() => service.getCharacter("cien\u0301")).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "CHARACTER_AMBIGUOUS" }),
    );
  });

  it("joins equipped instances, definitions and effects in domain slot order", () => {
    const result = service.getEquipment("laezel");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      assignment: { slot: "RING_1" },
      inventoryItem: { id: "inventory-ring" },
      definition: { namePl: "Pierścień Blasku" },
      effects: [{ id: "effect-ring" }],
    });
  });

  it("surfaces an inconsistent required join instead of fabricating a row", () => {
    connection.database.$client.pragma("foreign_keys = OFF");
    connection.database.$client
      .prepare("delete from item_definitions where id = 'definition-ring'")
      .run();

    expect(() => service.getEquipment("laezel")).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "INCONSISTENT_STATE" }),
    );
  });

  it("combines inventory filter categories with AND and repeated values with OR", () => {
    expect(
      service
        .findInventory({ slots: ["RING", "BODY"], statuses: ["CHEST", "EQUIPPED"] })
        .items.map((value) => value.inventoryItem.id),
    ).toEqual(["inventory-ring", "inventory-armor"]);
    expect(
      service
        .findInventory({ statuses: ["CHEST"], tags: ["aura", "promienne"] })
        .items.map((value) => value.inventoryItem.id),
    ).toEqual(["inventory-armor"]);
  });

  it("matches tag facets exactly without searching prose or inferring M14 tags", () => {
    expect(service.findInventory({ tags: ["  PROMIENNE "] }).items).toHaveLength(2);
    expect(
      service
        .findInventory({ tags: ["BONUS", "AURA"] })
        .items.map((value) => value.inventoryItem.id),
    ).toEqual(["inventory-ring", "inventory-armor"]);
    expect(service.findInventory({ tags: ["koncentracja"] }).items).toEqual([]);
    expect(service.findInventory({ tags: ["otrzymanie obrażeń"] }).items[0]?.inventoryItem.id).toBe(
      "inventory-armor",
    );
  });

  it("rejects invalid filters instead of returning an empty result", () => {
    expect(() => service.findInventory({ tags: ["  "] })).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "INVALID_FILTER" }),
    );
    expect(() => service.findInventory({ slots: ["INVALID" as never] })).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "INVALID_FILTER" }),
    );
  });

  it("preserves recorded spell flags and sorts by level then Polish name", () => {
    const result = service.getSpells("laezel");

    expect(result.spells.map((value) => value.definition.id)).toEqual([
      "spell-light",
      "spell-jump",
    ]);
    expect(result.spells[1]?.assignment).toMatchObject({
      source: "ITEM",
      known: false,
      prepared: false,
      alwaysPrepared: true,
    });
  });

  it("returns illithid definitions and prerequisites without inventing acquisition state", () => {
    const global = service.getIllithid();
    const character = service.getIllithid("laezel");

    expect(global.character).toBeNull();
    expect(global.powers.map((value) => value.definition.id)).toEqual([
      "power-tier-1",
      "power-tier-2",
      "power-unknown",
    ]);
    expect(global.powers.every((value) => value.acquisition === null)).toBe(true);
    expect(character.powers[0]?.acquisition?.acquisitionSourcePl).toBe("WYKUPIONA");
    expect(character.powers[1]?.prerequisitePowerIds).toEqual(["power-tier-1"]);
    expect(character.powers[1]).not.toHaveProperty("available");
    expect(character.powers[1]).not.toHaveProperty("blocked");
  });

  it("returns bounded audit summaries newest first without snapshot payloads", () => {
    const defaultResult = service.getChanges();
    const limited = service.getChanges(2);

    expect(defaultResult.limit).toBe(DEFAULT_CHANGE_LIMIT);
    expect(limited.changes.map((value) => value.id)).toEqual(["event-new-b", "event-new-a"]);
    expect(limited.changes[0]).not.toHaveProperty("beforeJson");
    expect(limited.changes[0]).not.toHaveProperty("afterJson");
    expect(() => service.getChanges(0)).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "INVALID_LIMIT" }),
    );
    expect(() => service.getChanges(1_001)).toThrowError(
      expect.objectContaining<Partial<CampaignInspectionError>>({ code: "INVALID_LIMIT" }),
    );
  });
});
