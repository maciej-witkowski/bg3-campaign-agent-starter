import { asc } from "drizzle-orm";

import type {
  CampaignImportState,
  CampaignImportStateReadPort,
} from "../../application/import/campaign-import-state.js";
import type { SqliteDatabase } from "./connection.js";
import {
  mapCharacter,
  mapCharacterIllithidPower,
  mapInventoryItem,
  mapPermanentModifier,
} from "./campaign-state-read-repository.js";
import {
  abilities,
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

export class SqliteCampaignImportStateReader implements CampaignImportStateReadPort {
  public constructor(private readonly database: SqliteDatabase) {}

  public readImportState(): CampaignImportState {
    return {
      characters: this.database
        .select()
        .from(characters)
        .orderBy(asc(characters.canonicalName), asc(characters.id))
        .all()
        .map(mapCharacter),
      characterAttributes: this.database
        .select()
        .from(characterAttributes)
        .orderBy(asc(characterAttributes.characterId), asc(characterAttributes.attribute))
        .all(),
      permanentModifiers: this.database
        .select()
        .from(permanentModifiers)
        .orderBy(asc(permanentModifiers.characterId), asc(permanentModifiers.id))
        .all()
        .map(mapPermanentModifier),
      itemDefinitions: this.database
        .select()
        .from(itemDefinitions)
        .orderBy(asc(itemDefinitions.normalizedNamePl), asc(itemDefinitions.id))
        .all(),
      itemEffects: this.database
        .select()
        .from(itemEffects)
        .orderBy(asc(itemEffects.itemDefinitionId), asc(itemEffects.id))
        .all(),
      inventoryItems: this.database
        .select()
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.itemDefinitionId), asc(inventoryItems.id))
        .all()
        .map(mapInventoryItem),
      equipment: this.database
        .select()
        .from(equipment)
        .orderBy(asc(equipment.characterId), asc(equipment.slot), asc(equipment.inventoryItemId))
        .all(),
      spells: this.database
        .select()
        .from(spells)
        .orderBy(asc(spells.normalizedNamePl), asc(spells.level), asc(spells.id))
        .all(),
      characterSpells: this.database
        .select()
        .from(characterSpells)
        .orderBy(
          asc(characterSpells.characterId),
          asc(characterSpells.spellId),
          asc(characterSpells.source),
        )
        .all(),
      abilities: this.database
        .select()
        .from(abilities)
        .orderBy(asc(abilities.normalizedNamePl), asc(abilities.type), asc(abilities.id))
        .all(),
      characterAbilities: this.database
        .select()
        .from(characterAbilities)
        .orderBy(
          asc(characterAbilities.characterId),
          asc(characterAbilities.abilityId),
          asc(characterAbilities.source),
        )
        .all(),
      illithidPowers: this.database
        .select()
        .from(illithidPowers)
        .orderBy(asc(illithidPowers.normalizedNamePl), asc(illithidPowers.id))
        .all(),
      illithidPowerPrerequisites: this.database
        .select()
        .from(illithidPowerPrerequisites)
        .orderBy(
          asc(illithidPowerPrerequisites.powerId),
          asc(illithidPowerPrerequisites.prerequisitePowerId),
        )
        .all(),
      characterIllithidPowers: this.database
        .select()
        .from(characterIllithidPowers)
        .orderBy(asc(characterIllithidPowers.characterId), asc(characterIllithidPowers.powerId))
        .all()
        .map(mapCharacterIllithidPower),
    };
  }
}
