import type { SqliteDatabase } from "../../../src/persistence/sqlite/connection.js";
import {
  abilities,
  changeEvents,
  characterAbilities,
  characterAttributes,
  characterIllithidPowers,
  characterSpells,
  characters,
  equipment,
  illithidPowerPrerequisites,
  illithidPowers,
  inventoryItems,
  itemDefinitions,
  itemEffects,
  permanentModifiers,
  spells,
} from "../../../src/persistence/sqlite/schema.js";

export const M3_FIXTURE_INSTANT = "2026-08-30T10:00:00.000Z";

export function seedM3CampaignFixture(database: SqliteDatabase): void {
  database
    .insert(characters)
    .values([
      character("character-laezel", "laezel", "Lae'zel", "Wojowniczka", true),
      character("character-astarion", "astarion", "Astarion", "Łotrzyk", true),
      character("character-gale", "gale", "Gale", "Mag", false),
      character("character-shadow-a", "shadow-a", "Cień", "Kleryczka", false),
      character("character-shadow-b", "shadow-b", "Cień", "Paladynka", false),
    ])
    .run();
  database
    .insert(characterAttributes)
    .values([
      { characterId: "character-laezel", attribute: "STR", baseValue: 17 },
      { characterId: "character-laezel", attribute: "DEX", baseValue: 13 },
      { characterId: "character-astarion", attribute: "DEX", baseValue: 18 },
    ])
    .run();
  database
    .insert(permanentModifiers)
    .values([
      {
        id: "modifier-active",
        characterId: "character-laezel",
        targetType: "ATTRIBUTE",
        targetKey: "STR",
        modifier: 2,
        sourceNamePl: "Mikstura Wiecznego Wigoru",
        sourceItemDefinitionId: null,
        provenanceType: "IMPORT",
        permanent: true,
        active: true,
        notes: null,
        createdAt: M3_FIXTURE_INSTANT,
      },
      {
        id: "modifier-inactive",
        characterId: "character-laezel",
        targetType: "ATTRIBUTE",
        targetKey: "STR",
        modifier: 5,
        sourceNamePl: "Nieaktywna próba",
        sourceItemDefinitionId: null,
        provenanceType: "SYSTEM",
        permanent: true,
        active: false,
        notes: null,
        createdAt: "2026-08-30T11:00:00.000Z",
      },
    ])
    .run();
  database
    .insert(abilities)
    .values({
      id: "ability-gwm",
      namePl: "Mistrz Broni Dwuręcznej",
      normalizedNamePl: "mistrz broni dwuręcznej",
      nameEn: null,
      type: "FEAT",
      descriptionPl: null,
      verificationStatus: "VERIFIED",
      notes: null,
    })
    .run();
  database
    .insert(characterAbilities)
    .values({
      characterId: "character-laezel",
      abilityId: "ability-gwm",
      source: "Poziom 4",
      levelAcquired: 4,
      notes: null,
    })
    .run();
  database
    .insert(itemDefinitions)
    .values([
      itemDefinition("definition-ring", "Pierścień Blasku", "RING"),
      itemDefinition("definition-armor", "Zbroja Świtu", "BODY"),
      itemDefinition("definition-story", "List fabularny", null),
    ])
    .run();
  database
    .insert(itemEffects)
    .values([
      itemEffect("effect-ring", "definition-ring", "BONUS", "Promienne", "Trafienie", "Premia"),
      itemEffect("effect-armor-a", "definition-armor", "AURA", "Promienne", null, "Promienna aura"),
      itemEffect(
        "effect-armor-b",
        "definition-armor",
        "OBRONA",
        null,
        "Otrzymanie obrażeń",
        "Koncentracja występuje tylko w opisie",
      ),
    ])
    .run();
  database
    .insert(inventoryItems)
    .values([
      {
        id: "inventory-ring",
        itemDefinitionId: "definition-ring",
        status: "EQUIPPED",
        ownerCharacterId: "character-laezel",
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      },
      {
        id: "inventory-armor",
        itemDefinitionId: "definition-armor",
        status: "CHEST",
        ownerCharacterId: null,
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      },
      {
        id: "inventory-story",
        itemDefinitionId: "definition-story",
        status: "PERSONAL_STORY",
        ownerCharacterId: "character-astarion",
        quantity: 1,
        obtainedAt: null,
        obtainedLocation: null,
        notes: null,
      },
    ])
    .run();
  database
    .insert(equipment)
    .values({
      inventoryItemId: "inventory-ring",
      characterId: "character-laezel",
      slot: "RING_1",
    })
    .run();
  database
    .insert(spells)
    .values([spell("spell-light", "Światło", 0), spell("spell-jump", "Skok", 1)])
    .run();
  database
    .insert(characterSpells)
    .values([
      {
        characterId: "character-laezel",
        spellId: "spell-jump",
        source: "ITEM",
        known: false,
        prepared: false,
        alwaysPrepared: true,
        notes: null,
      },
      {
        characterId: "character-laezel",
        spellId: "spell-light",
        source: "RACE",
        known: true,
        prepared: false,
        alwaysPrepared: false,
        notes: null,
      },
    ])
    .run();
  database
    .insert(illithidPowers)
    .values([
      illithidPower("power-tier-2", "Odpychający Wybuch", 2),
      illithidPower("power-tier-1", "Skupiony Wybuch", 1),
      illithidPower("power-unknown", "Nieznana Moc", null),
    ])
    .run();
  database
    .insert(illithidPowerPrerequisites)
    .values({ powerId: "power-tier-2", prerequisitePowerId: "power-tier-1" })
    .run();
  database
    .insert(characterIllithidPowers)
    .values({
      characterId: "character-laezel",
      powerId: "power-tier-1",
      acquiredAt: null,
      acquisitionSourcePl: "WYKUPIONA",
      notes: null,
    })
    .run();
  database
    .insert(changeEvents)
    .values([
      change("event-old", "2026-08-29T10:00:00.000Z", "Starsza zmiana"),
      change("event-new-b", M3_FIXTURE_INSTANT, "Nowsza zmiana B"),
      change("event-new-a", M3_FIXTURE_INSTANT, "Nowsza zmiana A"),
    ])
    .run();
}

function character(
  id: string,
  canonicalName: string,
  displayNamePl: string,
  classPl: string,
  activeParty: boolean,
) {
  return {
    id,
    canonicalName,
    displayNamePl,
    racePl: null,
    classPl,
    subclassPl: null,
    level: 8,
    roleSummary: "Testowa rola",
    activeParty,
    notes: null,
    createdAt: M3_FIXTURE_INSTANT,
    updatedAt: M3_FIXTURE_INSTANT,
  } as const;
}

function itemDefinition(id: string, namePl: string, slot: "RING" | "BODY" | null) {
  return {
    id,
    namePl,
    normalizedNamePl: namePl.toLocaleLowerCase("pl-PL"),
    nameEn: null,
    typePl: null,
    slot,
    rarityPl: null,
    descriptionPl: null,
    verificationStatus: "VERIFIED" as const,
    verificationConfidence: null,
    verificationSource: null,
    fingerprint: null,
    notes: null,
  };
}

function itemEffect(
  id: string,
  itemDefinitionId: string,
  effectType: string,
  damageType: string | null,
  trigger: string | null,
  descriptionPl: string,
) {
  return {
    id,
    itemDefinitionId,
    effectType,
    numericValue: null,
    diceExpression: null,
    damageType,
    trigger,
    conditionTextPl: null,
    durationTextPl: null,
    descriptionPl,
    verificationStatus: "VERIFIED" as const,
  };
}

function spell(id: string, namePl: string, level: number) {
  return {
    id,
    namePl,
    normalizedNamePl: namePl.toLocaleLowerCase("pl-PL"),
    nameEn: null,
    level,
    schoolPl: null,
    descriptionPl: null,
    verificationStatus: "VERIFIED" as const,
    notes: null,
  };
}

function illithidPower(id: string, namePl: string, tier: number | null) {
  return {
    id,
    namePl,
    normalizedNamePl: namePl.toLocaleLowerCase("pl-PL"),
    nameEn: null,
    tier,
    descriptionPl: null,
    verificationStatus: "VERIFIED" as const,
    notes: null,
  };
}

function change(id: string, occurredAt: string, summaryPl: string) {
  return {
    id,
    occurredAt,
    type: "TEST",
    characterId: null,
    checkpointId: null,
    proposalId: null,
    summaryPl,
    reasonPl: null,
    beforeJson: '{"private":"before"}',
    afterJson: '{"private":"after"}',
    reversesChangeEventId: null,
  };
}
