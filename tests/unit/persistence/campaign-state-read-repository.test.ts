import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteCampaignStateReadRepository } from "../../../src/persistence/sqlite/campaign-state-read-repository.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import {
  abilities,
  changeEvents,
  characterAbilities,
  characterAttributes,
  characterIllithidPowers,
  characterSpells,
  characters,
  checkpoints,
  equipment,
  illithidPowerPrerequisites,
  illithidPowers,
  inventoryItems,
  itemDefinitions,
  itemEffects,
  permanentModifiers,
  spells,
} from "../../../src/persistence/sqlite/schema.js";

const NOW = "2026-08-26T12:00:00.000Z";
let connection: SqliteConnection;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => connection?.close());

describe("SQLite campaign state read repository", () => {
  it("round-trips every M1 relation while preserving Polish text, nulls and instants", () => {
    const db = connection.database;
    db.insert(characters)
      .values({
        id: "character-1",
        canonicalName: "laezel",
        displayNamePl: "Lae'zel",
        racePl: "Githyanki",
        classPl: "Wojowniczka",
        subclassPl: null,
        level: 8,
        roleSummary: "Pierwsza linia",
        activeParty: true,
        notes: null,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();
    db.insert(characterAttributes)
      .values({ characterId: "character-1", attribute: "STR", baseValue: 17 })
      .run();
    db.insert(itemDefinitions)
      .values({
        id: "item-1",
        namePl: "Pierścień Łaski",
        normalizedNamePl: "pierścień łaski",
        nameEn: null,
        typePl: "Pierścień",
        slot: "RING",
        rarityPl: null,
        descriptionPl: null,
        verificationStatus: "UNVERIFIED",
        verificationConfidence: null,
        verificationSource: null,
        fingerprint: null,
        notes: null,
      })
      .run();
    db.insert(permanentModifiers)
      .values({
        id: "modifier-1",
        characterId: "character-1",
        targetType: "ATTRIBUTE",
        targetKey: "STR",
        modifier: 2,
        sourceNamePl: "Mikstura wiecznej siły",
        sourceItemDefinitionId: null,
        provenanceType: "GAME_UI",
        permanent: true,
        active: true,
        notes: null,
        createdAt: NOW,
      })
      .run();
    db.insert(itemEffects)
      .values({
        id: "effect-1",
        itemDefinitionId: "item-1",
        effectType: "BONUS",
        numericValue: null,
        diceExpression: null,
        damageType: null,
        trigger: null,
        conditionTextPl: null,
        durationTextPl: null,
        descriptionPl: "Premia do prób",
        verificationStatus: "UNVERIFIED",
      })
      .run();
    db.insert(inventoryItems)
      .values({
        id: "inventory-1",
        itemDefinitionId: "item-1",
        status: "EQUIPPED",
        ownerCharacterId: "character-1",
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      })
      .run();
    db.insert(equipment)
      .values({
        inventoryItemId: "inventory-1",
        characterId: "character-1",
        slot: "RING_1",
      })
      .run();
    db.insert(spells)
      .values({
        id: "spell-1",
        namePl: "Światło",
        normalizedNamePl: "światło",
        nameEn: null,
        level: 0,
        schoolPl: null,
        descriptionPl: null,
        verificationStatus: "VERIFIED",
        notes: null,
      })
      .run();
    db.insert(characterSpells)
      .values({
        characterId: "character-1",
        spellId: "spell-1",
        source: "ITEM",
        known: false,
        prepared: false,
        alwaysPrepared: true,
        notes: null,
      })
      .run();
    db.insert(abilities)
      .values({
        id: "ability-1",
        namePl: "Mistrz Broni Dwuręcznej",
        normalizedNamePl: "mistrz broni dwuręcznej",
        nameEn: null,
        type: "FEAT",
        descriptionPl: null,
        verificationStatus: "VERIFIED",
        notes: null,
      })
      .run();
    db.insert(characterAbilities)
      .values({
        characterId: "character-1",
        abilityId: "ability-1",
        source: "Poziom 4",
        levelAcquired: 4,
        notes: null,
      })
      .run();
    db.insert(illithidPowers)
      .values([
        {
          id: "power-1",
          namePl: "Skupiony Wybuch",
          normalizedNamePl: "skupiony wybuch",
          nameEn: null,
          tier: null,
          descriptionPl: null,
          verificationStatus: "UNKNOWN",
          notes: null,
        },
        {
          id: "power-2",
          namePl: "Odpychający Wybuch",
          normalizedNamePl: "odpychający wybuch",
          nameEn: null,
          tier: 2,
          descriptionPl: null,
          verificationStatus: "UNKNOWN",
          notes: null,
        },
      ])
      .run();
    db.insert(illithidPowerPrerequisites)
      .values({ powerId: "power-2", prerequisitePowerId: "power-1" })
      .run();
    db.insert(characterIllithidPowers)
      .values({
        characterId: "character-1",
        powerId: "power-1",
        acquiredAt: null,
        acquisitionSourcePl: null,
        notes: null,
      })
      .run();
    db.insert(changeEvents)
      .values({
        id: "event-1",
        occurredAt: NOW,
        type: "TEST",
        characterId: "character-1",
        proposalId: null,
        summaryPl: "Stan testowy",
        reasonPl: null,
        beforeJson: "{}",
        afterJson: "{}",
        reversesChangeEventId: null,
      })
      .run();
    db.insert(checkpoints)
      .values({
        id: "checkpoint-1",
        label: "Początek",
        createdAt: NOW,
        snapshotFormat: "BG3_CAMPAIGN_SNAPSHOT",
        snapshotVersion: 1,
        schemaVersion: 3,
        snapshotJson: "{}",
        snapshotSha256: "a".repeat(64),
        reasonPl: "Test",
        changeEventId: "event-1",
      })
      .run();

    const repository = new SqliteCampaignStateReadRepository(db);
    expect(repository.findCharacter("character-1")).toMatchObject({
      displayNamePl: "Lae'zel",
      subclassPl: null,
      notes: null,
      createdAt: new Date(NOW),
    });
    expect(repository.listCharacterAttributes("character-1")).toHaveLength(1);
    expect(repository.listPermanentModifiers("character-1")[0]).toMatchObject({
      sourceNamePl: "Mikstura wiecznej siły",
      sourceItemDefinitionId: null,
      createdAt: new Date(NOW),
    });
    expect(repository.findItemDefinition("item-1")).toMatchObject({
      namePl: "Pierścień Łaski",
      nameEn: null,
      rarityPl: null,
    });
    expect(repository.listItemEffects("item-1")[0]?.descriptionPl).toBe("Premia do prób");
    expect(repository.findInventoryItem("inventory-1")).toMatchObject({
      obtainedAt: null,
      obtainedLocation: null,
    });
    expect(repository.listEquipment("character-1")).toEqual([
      { inventoryItemId: "inventory-1", characterId: "character-1", slot: "RING_1" },
    ]);
    expect(repository.findSpell("spell-1")?.namePl).toBe("Światło");
    expect(repository.listCharacterSpells("character-1")).toHaveLength(1);
    expect(repository.findAbility("ability-1")?.namePl).toBe("Mistrz Broni Dwuręcznej");
    expect(repository.listCharacterAbilities("character-1")).toHaveLength(1);
    expect(repository.findIllithidPower("power-2")?.tier).toBe(2);
    expect(repository.listIllithidPrerequisites("power-2")).toHaveLength(1);
    expect(repository.listCharacterIllithidPowers("character-1")[0]?.acquiredAt).toBeNull();
    expect(repository.findChangeEvent("event-1")?.occurredAt).toEqual(new Date(NOW));
    expect(repository.findCheckpoint("checkpoint-1")?.label).toBe("Początek");
    expect(repository.findCharacter("missing")).toBeNull();
  });
});
