import { asc } from "drizzle-orm";

import type { CampaignValidationStateReader } from "../../domain/validation/campaign-validation.js";
import { mapInventoryItem, mapPermanentModifier } from "./campaign-state-read-repository.js";
import {
  characterSpells,
  equipment,
  inventoryItems,
  itemDefinitions,
  permanentModifiers,
} from "./schema.js";
import type { SqliteTransactionState } from "./transaction-types.js";

export class SqliteCampaignValidationStateReader implements CampaignValidationStateReader {
  public constructor(private readonly database: SqliteTransactionState) {}

  public listAllEquipment() {
    return this.database.select().from(equipment).orderBy(asc(equipment.inventoryItemId)).all();
  }

  public listAllInventoryItems() {
    return this.database
      .select()
      .from(inventoryItems)
      .orderBy(asc(inventoryItems.id))
      .all()
      .map(mapInventoryItem);
  }

  public listAllItemDefinitions() {
    return this.database.select().from(itemDefinitions).orderBy(asc(itemDefinitions.id)).all();
  }

  public listAllPermanentModifiers() {
    return this.database
      .select()
      .from(permanentModifiers)
      .orderBy(asc(permanentModifiers.id))
      .all()
      .map(mapPermanentModifier);
  }

  public listAllCharacterSpells() {
    return this.database
      .select()
      .from(characterSpells)
      .orderBy(
        asc(characterSpells.characterId),
        asc(characterSpells.spellId),
        asc(characterSpells.source),
      )
      .all();
  }
}
