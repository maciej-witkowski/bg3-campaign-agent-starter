import { asc, desc, eq } from "drizzle-orm";

import type {
  CampaignInspectionReadPort,
  CampaignInspectionReadSession,
} from "../../application/inspection/campaign-inspection.js";
import {
  mapCharacter,
  mapCharacterIllithidPower,
  mapInventoryItem,
  mapPermanentModifier,
} from "./campaign-state-read-repository.js";
import type { SqliteDatabase } from "./connection.js";
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
} from "./schema.js";
import type { SqliteTransactionState } from "./transaction-types.js";

export class SqliteCampaignInspectionReadPort implements CampaignInspectionReadPort {
  public constructor(private readonly database: SqliteDatabase) {}

  public read<T>(operation: (session: CampaignInspectionReadSession) => T): T {
    return this.database.transaction((transaction) =>
      operation(new SqliteCampaignInspectionReadSession(transaction)),
    );
  }
}

class SqliteCampaignInspectionReadSession implements CampaignInspectionReadSession {
  public constructor(private readonly database: SqliteTransactionState) {}

  public listCharacters() {
    return this.database
      .select()
      .from(characters)
      .orderBy(asc(characters.id))
      .all()
      .map(mapCharacter);
  }

  public listCharacterAttributes(characterId: string) {
    return this.database
      .select()
      .from(characterAttributes)
      .where(eq(characterAttributes.characterId, characterId))
      .orderBy(asc(characterAttributes.attribute))
      .all();
  }

  public listPermanentModifiers(characterId: string) {
    return this.database
      .select()
      .from(permanentModifiers)
      .where(eq(permanentModifiers.characterId, characterId))
      .orderBy(asc(permanentModifiers.createdAt), asc(permanentModifiers.id))
      .all()
      .map(mapPermanentModifier);
  }

  public listAbilities() {
    return this.database.select().from(abilities).orderBy(asc(abilities.id)).all();
  }

  public listCharacterAbilities(characterId: string) {
    return this.database
      .select()
      .from(characterAbilities)
      .where(eq(characterAbilities.characterId, characterId))
      .orderBy(asc(characterAbilities.abilityId), asc(characterAbilities.source))
      .all();
  }

  public listItemDefinitions() {
    return this.database.select().from(itemDefinitions).orderBy(asc(itemDefinitions.id)).all();
  }

  public listItemEffects() {
    return this.database
      .select()
      .from(itemEffects)
      .orderBy(asc(itemEffects.itemDefinitionId), asc(itemEffects.id))
      .all();
  }

  public listInventoryItems() {
    return this.database
      .select()
      .from(inventoryItems)
      .orderBy(asc(inventoryItems.id))
      .all()
      .map(mapInventoryItem);
  }

  public listEquipment(characterId?: string) {
    if (characterId === undefined) {
      return this.database
        .select()
        .from(equipment)
        .orderBy(asc(equipment.characterId), asc(equipment.slot), asc(equipment.inventoryItemId))
        .all();
    }
    return this.database
      .select()
      .from(equipment)
      .where(eq(equipment.characterId, characterId))
      .orderBy(asc(equipment.slot), asc(equipment.inventoryItemId))
      .all();
  }

  public listSpells() {
    return this.database.select().from(spells).orderBy(asc(spells.id)).all();
  }

  public listCharacterSpells(characterId: string) {
    return this.database
      .select()
      .from(characterSpells)
      .where(eq(characterSpells.characterId, characterId))
      .orderBy(asc(characterSpells.spellId), asc(characterSpells.source))
      .all();
  }

  public listIllithidPowers() {
    return this.database.select().from(illithidPowers).orderBy(asc(illithidPowers.id)).all();
  }

  public listIllithidPrerequisites() {
    return this.database
      .select()
      .from(illithidPowerPrerequisites)
      .orderBy(
        asc(illithidPowerPrerequisites.powerId),
        asc(illithidPowerPrerequisites.prerequisitePowerId),
      )
      .all();
  }

  public listCharacterIllithidPowers(characterId: string) {
    return this.database
      .select()
      .from(characterIllithidPowers)
      .where(eq(characterIllithidPowers.characterId, characterId))
      .orderBy(asc(characterIllithidPowers.powerId))
      .all()
      .map(mapCharacterIllithidPower);
  }

  public listRecentChanges(limit: number) {
    return this.database
      .select({
        id: changeEvents.id,
        occurredAt: changeEvents.occurredAt,
        type: changeEvents.type,
        characterId: changeEvents.characterId,
        checkpointId: changeEvents.checkpointId,
        proposalId: changeEvents.proposalId,
        summaryPl: changeEvents.summaryPl,
        reasonPl: changeEvents.reasonPl,
        reversesChangeEventId: changeEvents.reversesChangeEventId,
      })
      .from(changeEvents)
      .orderBy(desc(changeEvents.occurredAt), desc(changeEvents.id))
      .limit(limit)
      .all()
      .map((row) => ({ ...row, occurredAt: new Date(row.occurredAt) }));
  }
}
