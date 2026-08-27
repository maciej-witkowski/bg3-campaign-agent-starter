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
  ItemCatalogMutationService,
} from "../../../src/domain/services/m1-mutation-services.js";
import { CampaignValidationError } from "../../../src/domain/validation/campaign-validation.js";
import { SqliteCampaignStateReadRepository } from "../../../src/persistence/sqlite/campaign-state-read-repository.js";
import { CampaignMutationCoordinator } from "../../../src/persistence/sqlite/campaign-mutation-coordinator.js";
import type { SqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import {
  abilities,
  changeEvents,
  characterAbilities,
  characterAttributes,
  characterSpells,
  characters,
  equipment,
  illithidPowers,
  inventoryItems,
  itemEffects,
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

  it("swaps assignments atomically without redundant placement input", () => {
    seedEquipment();

    const result = new InventoryMutationService(createCoordinator()).setEquipment(
      {
        items: [],
        assignments: [
          { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
          { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
        ],
      },
      { type: "EQUIPMENT_SWAP", summaryPl: "Zamiana samych przypisań" },
    );

    expect(result.changed).toBe(true);
    expect(
      connection.database
        .select({
          id: inventoryItems.id,
          status: inventoryItems.status,
          ownerCharacterId: inventoryItems.ownerCharacterId,
        })
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.id))
        .all(),
    ).toEqual([
      { id: "item-a", status: "EQUIPPED", ownerCharacterId: "hero" },
      { id: "item-b", status: "EQUIPPED", ownerCharacterId: "hero" },
    ]);
    expect(
      connection.database.select().from(equipment).orderBy(asc(equipment.inventoryItemId)).all(),
    ).toEqual([
      { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
      { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
    ]);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(1);
  });

  it("keeps an identical assignment-only command as a no-op", () => {
    seedEquipment();

    const result = new InventoryMutationService(createCoordinator()).setEquipment(
      {
        items: [],
        assignments: [{ inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" }],
      },
      { type: "EQUIPMENT_SET", summaryPl: "Identyczne przypisanie" },
    );

    expect(result).toEqual({ changed: false });
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it.each(["duplicate target", "omitted occupant"] as const)(
    "rejects equipment slot conflict: %s",
    (conflictKind) => {
      seedEquipment();
      const before = snapshot(connection.database as never).capture();

      expect(() =>
        new InventoryMutationService(createCoordinator()).setEquipment(
          {
            items: [],
            assignments:
              conflictKind === "duplicate target"
                ? [
                    { inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" },
                    { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
                  ]
                : [{ inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" }],
          },
          { type: "EQUIPMENT_SET", summaryPl: "Niepełny konflikt pozycji" },
        ),
      ).toThrow(CampaignDomainError);
      expect(snapshot(connection.database as never).capture()).toBe(before);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it("returns unchanged and writes no audit for an identical equipment aggregate", () => {
    seedEquipment();

    const result = new InventoryMutationService(createCoordinator()).setEquipment(
      {
        items: [inventory("item-a"), inventory("item-b")],
        assignments: [
          { inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" },
          { inventoryItemId: "item-b", characterId: "hero", slot: "RING_2" },
        ],
      },
      { type: "EQUIPMENT_SET", summaryPl: "Identyczne wyposażenie" },
    );

    expect(result).toEqual({ changed: false });
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    expect(
      connection.database.select().from(equipment).orderBy(asc(equipment.inventoryItemId)).all(),
    ).toEqual([
      { inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" },
      { inventoryItemId: "item-b", characterId: "hero", slot: "RING_2" },
    ]);
  });

  it.each(["placement", "assignment"] as const)(
    "rejects a missing %s inventory item without state or audit writes",
    (inputKind) => {
      const before = snapshot(connection.database as never).capture();

      expect(() =>
        new InventoryMutationService(createCoordinator()).setEquipment(
          {
            items:
              inputKind === "placement"
                ? [{ id: "missing", status: "CHEST", ownerCharacterId: null }]
                : [],
            assignments:
              inputKind === "assignment"
                ? [{ inventoryItemId: "missing", characterId: "hero", slot: "RING_1" }]
                : [],
          },
          { type: "EQUIPMENT_SET", summaryPl: "Brakujący element" },
        ),
      ).toThrow(CampaignDomainError);
      expect(snapshot(connection.database as never).capture()).toBe(before);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it.each(["placement", "assignment"] as const)(
    "rejects conflicting duplicate equipment %s entries transactionally",
    (inputKind) => {
      seedEquipment();
      const before = snapshot(connection.database as never).capture();

      expect(() =>
        new InventoryMutationService(createCoordinator()).setEquipment(
          {
            items:
              inputKind === "placement"
                ? [
                    { id: "item-a", status: "CHEST", ownerCharacterId: null },
                    { id: "item-a", status: "SITUATIONAL", ownerCharacterId: null },
                  ]
                : [],
            assignments:
              inputKind === "assignment"
                ? [
                    { inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" },
                    { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
                  ]
                : [],
          },
          { type: "EQUIPMENT_SET", summaryPl: "Sprzeczne duplikaty" },
        ),
      ).toThrow(CampaignDomainError);
      expect(snapshot(connection.database as never).capture()).toBe(before);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it("deduplicates identical equipment entries before no-op detection", () => {
    seedEquipment();
    const placement = inventory("item-a");
    const assignment = {
      inventoryItemId: "item-a",
      characterId: "hero",
      slot: "RING_1",
    } as const;

    const result = new InventoryMutationService(createCoordinator()).setEquipment(
      { items: [placement, placement], assignments: [assignment, assignment] },
      { type: "EQUIPMENT_SET", summaryPl: "Identyczne duplikaty" },
    );

    expect(result).toEqual({ changed: false });
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it.each([
    "nameEn",
    "typePl",
    "rarityPl",
    "descriptionPl",
    "verificationSource",
    "fingerprint",
    "notes",
  ] as const)("rejects blank optional item fact %s transactionally", (field) => {
    expect(() =>
      new ItemCatalogMutationService(createCoordinator()).createDefinition(
        { ...itemDefinition(), [field]: "   " },
        { type: "ITEM_DEFINITION_CREATE", summaryPl: "Nowa definicja" },
      ),
    ).toThrow(CampaignDomainError);
    expect(connection.database.select().from(itemDefinitions).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it("preserves null for unknown optional item facts", () => {
    new ItemCatalogMutationService(createCoordinator()).createDefinition(itemDefinition(), {
      type: "ITEM_DEFINITION_CREATE",
      summaryPl: "Nowa definicja",
    });

    expect(connection.database.select().from(itemDefinitions).get()).toMatchObject({
      nameEn: null,
      typePl: null,
      rarityPl: null,
      descriptionPl: null,
      verificationSource: null,
      fingerprint: null,
      notes: null,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite optional numeric facts (%s) transactionally",
    (invalidNumber) => {
      const service = new ItemCatalogMutationService(createCoordinator());
      expect(() =>
        service.createDefinition(
          { ...itemDefinition(), verificationConfidence: invalidNumber },
          { type: "ITEM_DEFINITION_CREATE", summaryPl: "Niepoprawna pewność" },
        ),
      ).toThrow(CampaignDomainError);

      connection.database.insert(itemDefinitions).values(itemDefinition()).run();
      expect(() =>
        service.addEffect(
          {
            id: "effect",
            itemDefinitionId: "ring",
            effectType: "BONUS",
            numericValue: invalidNumber,
            diceExpression: null,
            damageType: null,
            trigger: null,
            conditionTextPl: null,
            durationTextPl: null,
            descriptionPl: "Efekt testowy",
            verificationStatus: "UNKNOWN",
          },
          { type: "ITEM_EFFECT_CREATE", summaryPl: "Niepoprawna wartość" },
        ),
      ).toThrow(CampaignDomainError);
      expect(connection.database.select().from(itemEffects).all()).toEqual([]);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it.each(["reasonPl", "proposalId"] as const)(
    "rejects blank optional audit metadata %s and rolls back state",
    (field) => {
      expect(() =>
        new CharacterMutationService(createCoordinator()).createCharacter(hero(), {
          ...metadata,
          [field]: "   ",
        }),
      ).toThrow(CampaignDomainError);
      expect(connection.database.select().from(characters).all()).toEqual([]);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it("rolls back equipment placement and audit when a stacked row is equipped", () => {
    connection.database.insert(characters).values(characterRow()).run();
    connection.database.insert(itemDefinitions).values(itemDefinition()).run();
    connection.database
      .insert(inventoryItems)
      .values({
        ...inventoryRow("item-a"),
        status: "CHEST",
        ownerCharacterId: null,
        quantity: 2,
        obtainedLocation: "Skrzynia obozowa",
      })
      .run();
    const before = connection.database.select().from(inventoryItems).get();

    expect(() =>
      new InventoryMutationService(createCoordinator()).setEquipment(
        {
          items: [{ id: "item-a", status: "EQUIPPED", ownerCharacterId: "hero" }],
          assignments: [{ inventoryItemId: "item-a", characterId: "hero", slot: "RING_1" }],
        },
        { type: "EQUIPMENT_SET", summaryPl: "Próba założenia stosu" },
      ),
    ).toThrow(CampaignValidationError);
    expect(connection.database.select().from(inventoryItems).get()).toEqual(before);
    expect(connection.database.select().from(equipment).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it("changes only inventory placement when equipment input contains stale item data", () => {
    seedEquipment();
    connection.database
      .insert(itemDefinitions)
      .values({
        ...itemDefinition(),
        id: "stale-ring",
        namePl: "Nieaktualny pierścień",
        normalizedNamePl: "nieaktualny pierscien",
      })
      .run();
    const obtainedAt = "2026-08-01T10:00:00.000Z";
    connection.database
      .update(inventoryItems)
      .set({
        ownerCharacterId: null,
        quantity: 1,
        obtainedAt,
        obtainedLocation: "Gaj druidów",
        notes: "Dane kanoniczne",
      })
      .where(eq(inventoryItems.id, "item-a"))
      .run();
    const staleItem: InventoryItem = {
      ...inventory("item-a"),
      itemDefinitionId: "stale-ring",
      quantity: 99,
      obtainedAt: new Date("2020-01-01T00:00:00.000Z"),
      obtainedLocation: "Nieaktualne miejsce",
      notes: "Nieaktualne notatki",
    };

    new InventoryMutationService(createCoordinator()).setEquipment(
      {
        items: [staleItem, inventory("item-b")],
        assignments: [
          { inventoryItemId: "item-a", characterId: "hero", slot: "RING_2" },
          { inventoryItemId: "item-b", characterId: "hero", slot: "RING_1" },
        ],
      },
      { type: "EQUIPMENT_SWAP", summaryPl: "Zamiana pierścieni" },
    );

    expect(
      connection.database
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, "item-a"))
        .get(),
    ).toMatchObject({
      itemDefinitionId: "ring",
      status: "EQUIPPED",
      ownerCharacterId: "hero",
      quantity: 1,
      obtainedAt,
      obtainedLocation: "Gaj druidów",
      notes: "Dane kanoniczne",
    });
  });

  it("rejects fractional optional integers transactionally without an audit event", () => {
    connection.database.insert(characters).values(characterRow()).run();
    connection.database
      .insert(abilities)
      .values({
        id: "ability",
        namePl: "Zdolność",
        normalizedNamePl: "zdolnosc",
        nameEn: null,
        type: "CLASS_FEATURE",
        descriptionPl: null,
        verificationStatus: "UNKNOWN",
        notes: null,
      })
      .run();
    const service = new CharacterCapabilityMutationService(createCoordinator());

    expect(() =>
      service.setAbility(
        {
          characterId: "hero",
          abilityId: "ability",
          source: "CLASS",
          levelAcquired: 1.5,
          notes: null,
        },
        { type: "ABILITY_SET", summaryPl: "Niepoprawny poziom" },
      ),
    ).toThrow(CampaignDomainError);
    expect(() =>
      service.createIllithidPower(
        {
          id: "power",
          namePl: "Moc",
          normalizedNamePl: "moc",
          nameEn: null,
          tier: 1.5,
          descriptionPl: null,
          verificationStatus: "UNKNOWN",
          notes: null,
        },
        { type: "ILLITHID_POWER_CREATE", summaryPl: "Niepoprawny poziom mocy" },
      ),
    ).toThrow(CampaignDomainError);

    expect(connection.database.select().from(characterAbilities).all()).toEqual([]);
    expect(connection.database.select().from(illithidPowers).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
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
