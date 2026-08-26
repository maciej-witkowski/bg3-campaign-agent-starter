import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as publicApi from "../../../src/index.js";

import type {
  Character,
  InventoryItem,
  ItemDefinition,
} from "../../../src/domain/model/campaign.js";
import {
  CampaignDomainError,
  CampaignPersistenceError,
  type CampaignSnapshotPort,
} from "../../../src/domain/mutations/campaign-mutation.js";
import {
  AuditReversalMutationService,
  CharacterCapabilityMutationService,
  CharacterMutationService,
  InventoryMutationService,
} from "../../../src/domain/services/m1-mutation-services.js";
import { CampaignValidationError } from "../../../src/domain/validation/campaign-validation.js";
import { SqliteCampaignStateReadRepository } from "../../../src/persistence/sqlite/campaign-state-read-repository.js";
import { CampaignMutationCoordinator } from "../../../src/persistence/sqlite/campaign-mutation-coordinator.js";
import type { SqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import {
  changeEvents,
  characterAttributes,
  characterSpells,
  characters,
  equipment,
  inventoryItems,
  itemDefinitions,
  spells,
} from "../../../src/persistence/sqlite/schema.js";
import type { SqliteTransaction } from "../../../src/persistence/sqlite/transaction-types.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";

const occurredAt = new Date("2026-08-26T12:34:56.000Z");
const metadata = { type: "CHARACTER_UPDATE", summaryPl: "Aktualizacja postaci" } as const;

type OptionalWithUndefined<T> = { [Key in keyof T]?: T[Key] | undefined };

describe("CampaignMutationCoordinator", () => {
  let connection: SqliteConnection;
  let nextId: number;

  beforeEach(() => {
    connection = openMigratedSqliteConnection({ filename: ":memory:" });
    nextId = 1;
  });

  afterEach(() => connection.close());

  it("captures before/write/validate/after and inserts exactly one deterministic event", () => {
    const coordinator = createCoordinator();
    const result = new CharacterMutationService(coordinator).createCharacter(hero(), metadata);

    expect(result).toEqual({ changed: true, changeEventId: "event-1", occurredAt });
    const events = connection.database.select().from(changeEvents).all();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "event-1",
      occurredAt: occurredAt.toISOString(),
      type: metadata.type,
      summaryPl: metadata.summaryPl,
      characterId: "hero",
      beforeJson: JSON.stringify({ characters: [], attributes: [], inventory: [], equipment: [] }),
    });
    expect(JSON.parse(events[0]?.afterJson ?? "{}").characters).toEqual(["hero"]);
  });

  it("returns an explicit no-op and writes no audit event", () => {
    const coordinator = createCoordinator();
    const service = new CharacterMutationService(coordinator);
    service.createCharacter(hero(), metadata);
    service.setAttribute(
      { characterId: "hero", attribute: "STR", baseValue: 17 },
      { type: "ATTRIBUTE_SET", summaryPl: "Ustawienie siły" },
    );
    const before = connection.database.select().from(changeEvents).all().length;

    const result = service.setAttribute(
      { characterId: "hero", attribute: "STR", baseValue: 17 },
      { type: "ATTRIBUTE_SET", summaryPl: "Ustawienie siły" },
    );

    expect(result).toEqual({ changed: false });
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(before);
  });

  it("rolls back and safely translates a repository constraint failure", () => {
    const service = new CharacterMutationService(createCoordinator());
    service.createCharacter(hero(), metadata);
    const duplicate = { ...hero(), id: "hero-duplicate" };

    expect(() => service.createCharacter(duplicate, metadata)).toThrow(CampaignPersistenceError);
    expect(connection.database.select().from(characters).all()).toHaveLength(1);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(1);
  });
  it("validates the uncommitted transaction state and rolls back an invalid spell relation", () => {
    connection.database.insert(characters).values(characterRow()).run();
    connection.database
      .insert(spells)
      .values({
        id: "spell",
        namePl: "Testowe zaklęcie",
        normalizedNamePl: "testowe zaklecie",
        nameEn: null,
        level: 1,
        schoolPl: null,
        descriptionPl: null,
        verificationStatus: "UNKNOWN",
        notes: null,
      })
      .run();
    const service = new CharacterCapabilityMutationService(createCoordinator());

    expect(() =>
      service.setSpell(
        {
          characterId: "hero",
          spellId: "spell",
          source: "CLASS",
          known: false,
          prepared: true,
          alwaysPrepared: false,
          notes: null,
        },
        { type: "SPELL_SET", summaryPl: "Niepoprawne przygotowanie" },
      ),
    ).toThrow(CampaignValidationError);
    expect(connection.database.select().from(characterSpells).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });
  it("swaps equipment atomically and creates one event", () => {
    seedEquipment();
    const service = new InventoryMutationService(createCoordinator());
    const result = service.setEquipment(
      {
        items: [inventory("item-a"), inventory("item-b")],
        assignments: [
          { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
          { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
        ],
      },
      { type: "EQUIPMENT_SWAP", summaryPl: "Zamiana pierścieni" },
    );

    expect(result.changed).toBe(true);
    expect(
      connection.database.select().from(equipment).orderBy(asc(equipment.inventoryItemId)).all(),
    ).toEqual([
      { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
      { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
    ]);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(1);
  });

  it.each(["write", "validation", "before snapshot", "after snapshot", "audit"] as const)(
    "rolls back state and audit after %s failure",
    (failure) => {
      let captures = 0;
      const coordinator = createCoordinator({
        snapshotter:
          failure === "before snapshot" || failure === "after snapshot"
            ? () => ({
                capture: () => {
                  captures += 1;
                  if (failure === "before snapshot" || captures === 2) throw new Error("snapshot");
                  return "{}";
                },
              })
            : undefined,
        validator:
          failure === "validation"
            ? () => ({
                validate: () => [
                  { code: "SPELL_PREPARATION_INVALID", entityIds: ["hero"], message: "invalid" },
                ],
              })
            : undefined,
        auditInsert:
          failure === "audit"
            ? () => {
                throw new Error("audit");
              }
            : undefined,
      });

      const run = () =>
        coordinator.execute(metadata, (writes) => {
          writes.insertCharacter(hero());
          if (failure === "write") throw new CampaignDomainError("write");
          return true;
        });

      expect(run).toThrow(
        failure === "validation"
          ? CampaignValidationError
          : failure === "write"
            ? CampaignDomainError
            : CampaignPersistenceError,
      );
      expect(connection.database.select().from(characters).all()).toHaveLength(0);
      expect(connection.database.select().from(changeEvents).all()).toHaveLength(0);
    },
  );

  it("keeps audit append-only and records reversal as a new referencing event", () => {
    const coordinator = createCoordinator();
    new CharacterMutationService(coordinator).createCharacter(hero(), metadata);
    const original = connection.database
      .select()
      .from(changeEvents)
      .where(eq(changeEvents.id, "event-1"))
      .get();

    new AuditReversalMutationService(coordinator).recordReversal("event-1", {
      type: "REVERSAL_RECORDED",
      summaryPl: "Odwrócenie zmiany",
    });

    expect(connection.database.select().from(changeEvents).all()).toHaveLength(2);
    expect(
      connection.database.select().from(changeEvents).where(eq(changeEvents.id, "event-1")).get(),
    ).toEqual(original);
    expect(
      connection.database.select().from(changeEvents).where(eq(changeEvents.id, "event-2")).get(),
    ).toMatchObject({ reversesChangeEventId: "event-1" });
    expect(() =>
      connection.database
        .update(changeEvents)
        .set({ summaryPl: "Niedozwolona zmiana" })
        .where(eq(changeEvents.id, "event-1"))
        .run(),
    ).toThrow(/append-only/);
    expect(() =>
      connection.database.delete(changeEvents).where(eq(changeEvents.id, "event-1")).run(),
    ).toThrow(/append-only/);
  });

  it("performs read-only repository work with zero state or audit writes", () => {
    new CharacterMutationService(createCoordinator()).createCharacter(hero(), metadata);
    const eventsBefore = connection.database.select().from(changeEvents).all();
    const stateBefore = snapshot(connection.database as never).capture();

    const repository = new SqliteCampaignStateReadRepository(connection.database);
    expect(repository.findCharacter("hero")?.displayNamePl).toBe("Bohater");
    expect(repository.listCharacterAttributes("hero")).toEqual([]);

    expect(snapshot(connection.database as never).capture()).toBe(stateBefore);
    expect(connection.database.select().from(changeEvents).all()).toEqual(eventsBefore);
  });

  it("does not expose generic writes, the coordinator or SQLite handles from the package API", () => {
    expect(publicApi).not.toHaveProperty("CampaignMutationCoordinator");
    expect(publicApi).not.toHaveProperty("SqliteCampaignStateWriteRepository");
    expect(publicApi).not.toHaveProperty("openSqliteConnection");
  });

  function createCoordinator(
    overrides: OptionalWithUndefined<
      ConstructorParameters<typeof CampaignMutationCoordinator>[1]
    > = {},
  ) {
    return new CampaignMutationCoordinator(connection.database, {
      clock: { now: () => occurredAt },
      ids: { nextId: () => `event-${nextId++}` },
      snapshotter: snapshot,
      ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
    });
  }

  function seedEquipment(): void {
    connection.database.insert(characters).values(characterRow()).run();
    connection.database.insert(itemDefinitions).values(itemDefinition()).run();
    connection.database
      .insert(inventoryItems)
      .values([inventoryRow("item-a"), inventoryRow("item-b")])
      .run();
    connection.database
      .insert(equipment)
      .values([
        { inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" },
        { inventoryItemId: "item-b", characterId: "hero", slot: "RING_2" },
      ])
      .run();
  }
});

function snapshot(transaction: SqliteTransaction): CampaignSnapshotPort {
  return {
    capture: () =>
      JSON.stringify({
        characters: transaction
          .select({ id: characters.id })
          .from(characters)
          .orderBy(asc(characters.id))
          .all()
          .map((row) => row.id),
        attributes: transaction
          .select()
          .from(characterAttributes)
          .orderBy(asc(characterAttributes.characterId), asc(characterAttributes.attribute))
          .all(),
        inventory: transaction
          .select({ id: inventoryItems.id, status: inventoryItems.status })
          .from(inventoryItems)
          .orderBy(asc(inventoryItems.id))
          .all(),
        equipment: transaction
          .select()
          .from(equipment)
          .orderBy(asc(equipment.inventoryItemId))
          .all(),
      }),
  };
}

function hero(): Character {
  return {
    id: "hero",
    canonicalName: "bohater",
    displayNamePl: "Bohater",
    racePl: null,
    classPl: "Wojownik",
    subclassPl: null,
    level: 1,
    roleSummary: "Front",
    activeParty: true,
    notes: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function characterRow() {
  return { ...hero(), createdAt: occurredAt.toISOString(), updatedAt: occurredAt.toISOString() };
}

function itemDefinition(): ItemDefinition {
  return {
    id: "ring",
    namePl: "Pierścień testowy",
    normalizedNamePl: "pierscien testowy",
    nameEn: null,
    typePl: null,
    slot: "RING",
    rarityPl: null,
    descriptionPl: null,
    verificationStatus: "UNKNOWN",
    verificationConfidence: null,
    verificationSource: null,
    fingerprint: null,
    notes: null,
  };
}

function inventory(id: string): InventoryItem {
  return {
    id,
    itemDefinitionId: "ring",
    status: "EQUIPPED",
    ownerCharacterId: "hero",
    quantity: 1,
    obtainedAt: null,
    obtainedLocation: null,
    notes: null,
  };
}

function inventoryRow(id: string) {
  return { ...inventory(id), obtainedAt: null };
}
