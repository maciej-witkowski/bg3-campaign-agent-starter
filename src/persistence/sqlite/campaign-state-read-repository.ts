import { asc, eq } from "drizzle-orm";

import type {
  ChangeEvent,
  Character,
  CharacterIllithidPower,
  Checkpoint,
  InventoryItem,
  PermanentModifier,
} from "../../domain/model/campaign.js";
import type { CampaignStateReadRepository } from "../../domain/repositories/campaign-state-read-repository.js";
import type { SqliteDatabase } from "./connection.js";
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
} from "./schema.js";

const date = (value: string): Date => new Date(value);
const nullableDate = (value: string | null): Date | null => (value === null ? null : date(value));

export function mapCharacter(row: typeof characters.$inferSelect): Character {
  return { ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) };
}
export function mapPermanentModifier(
  row: typeof permanentModifiers.$inferSelect,
): PermanentModifier {
  return { ...row, createdAt: date(row.createdAt) };
}
export function mapInventoryItem(row: typeof inventoryItems.$inferSelect): InventoryItem {
  return { ...row, obtainedAt: nullableDate(row.obtainedAt) };
}
export function mapCharacterIllithidPower(
  row: typeof characterIllithidPowers.$inferSelect,
): CharacterIllithidPower {
  return { ...row, acquiredAt: nullableDate(row.acquiredAt) };
}
export function mapChangeEvent(row: typeof changeEvents.$inferSelect): ChangeEvent {
  return { ...row, occurredAt: date(row.occurredAt) };
}
export function mapCheckpoint(row: typeof checkpoints.$inferSelect): Checkpoint {
  return { ...row, createdAt: date(row.createdAt) };
}

export class SqliteCampaignStateReadRepository implements CampaignStateReadRepository {
  public constructor(private readonly database: SqliteDatabase) {}

  public findCharacter(id: string) {
    const row = this.database.select().from(characters).where(eq(characters.id, id)).get();
    return row === undefined ? null : mapCharacter(row);
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

  public findItemDefinition(id: string) {
    return (
      this.database.select().from(itemDefinitions).where(eq(itemDefinitions.id, id)).get() ?? null
    );
  }

  public listItemEffects(itemDefinitionId: string) {
    return this.database
      .select()
      .from(itemEffects)
      .where(eq(itemEffects.itemDefinitionId, itemDefinitionId))
      .orderBy(asc(itemEffects.id))
      .all();
  }

  public findInventoryItem(id: string) {
    const row = this.database.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
    return row === undefined ? null : mapInventoryItem(row);
  }

  public listEquipment(characterId: string) {
    return this.database
      .select()
      .from(equipment)
      .where(eq(equipment.characterId, characterId))
      .orderBy(asc(equipment.slot))
      .all();
  }

  public findSpell(id: string) {
    return this.database.select().from(spells).where(eq(spells.id, id)).get() ?? null;
  }

  public listCharacterSpells(characterId: string) {
    return this.database
      .select()
      .from(characterSpells)
      .where(eq(characterSpells.characterId, characterId))
      .orderBy(asc(characterSpells.spellId), asc(characterSpells.source))
      .all();
  }

  public findAbility(id: string) {
    return this.database.select().from(abilities).where(eq(abilities.id, id)).get() ?? null;
  }

  public listCharacterAbilities(characterId: string) {
    return this.database
      .select()
      .from(characterAbilities)
      .where(eq(characterAbilities.characterId, characterId))
      .orderBy(asc(characterAbilities.abilityId), asc(characterAbilities.source))
      .all();
  }

  public findIllithidPower(id: string) {
    return (
      this.database.select().from(illithidPowers).where(eq(illithidPowers.id, id)).get() ?? null
    );
  }

  public listIllithidPrerequisites(powerId: string) {
    return this.database
      .select()
      .from(illithidPowerPrerequisites)
      .where(eq(illithidPowerPrerequisites.powerId, powerId))
      .orderBy(asc(illithidPowerPrerequisites.prerequisitePowerId))
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

  public findChangeEvent(id: string) {
    const row = this.database.select().from(changeEvents).where(eq(changeEvents.id, id)).get();
    return row === undefined ? null : mapChangeEvent(row);
  }

  public findCheckpoint(id: string) {
    const row = this.database.select().from(checkpoints).where(eq(checkpoints.id, id)).get();
    return row === undefined ? null : mapCheckpoint(row);
  }
}
