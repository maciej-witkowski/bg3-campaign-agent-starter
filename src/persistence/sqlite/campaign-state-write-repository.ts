import { and, eq } from "drizzle-orm";

import type {
  Ability,
  Character,
  CharacterAbility,
  CharacterAttribute,
  CharacterIllithidPower,
  CharacterSpell,
  Checkpoint,
  EquipmentAssignment,
  IllithidPower,
  IllithidPowerPrerequisite,
  InventoryItem,
  InventoryPlacement,
  ItemDefinition,
  ItemEffect,
  PermanentModifier,
  Spell,
} from "../../domain/model/campaign.js";
import type { CampaignStateWriteRepository } from "../../domain/repositories/campaign-state-write-repository.js";
import {
  abilities,
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
import type { SqliteTransaction } from "./transaction-types.js";

const instant = (value: Date): string => value.toISOString();
const nullableInstant = (value: Date | null): string | null =>
  value === null ? null : instant(value);

export class SqliteCampaignStateWriteRepository implements CampaignStateWriteRepository {
  public constructor(private readonly transaction: SqliteTransaction) {}
  public insertCheckpoint(value: Checkpoint): void {
    this.transaction
      .insert(checkpoints)
      .values({ ...value, createdAt: instant(value.createdAt) })
      .run();
  }

  public insertCharacter(value: Character): void {
    this.transaction
      .insert(characters)
      .values({
        ...value,
        createdAt: instant(value.createdAt),
        updatedAt: instant(value.updatedAt),
      })
      .run();
  }

  public setCharacterAttribute(value: CharacterAttribute): boolean {
    const current = this.transaction
      .select()
      .from(characterAttributes)
      .where(
        and(
          eq(characterAttributes.characterId, value.characterId),
          eq(characterAttributes.attribute, value.attribute),
        ),
      )
      .get();
    if (current?.baseValue === value.baseValue) return false;
    this.transaction
      .insert(characterAttributes)
      .values(value)
      .onConflictDoUpdate({
        target: [characterAttributes.characterId, characterAttributes.attribute],
        set: { baseValue: value.baseValue },
      })
      .run();
    return true;
  }

  public insertPermanentModifier(value: PermanentModifier): void {
    this.transaction
      .insert(permanentModifiers)
      .values({
        ...value,
        createdAt: instant(value.createdAt),
      })
      .run();
  }

  public insertItemDefinition(value: ItemDefinition): void {
    this.transaction.insert(itemDefinitions).values(value).run();
  }

  public insertItemEffect(value: ItemEffect): void {
    this.transaction.insert(itemEffects).values(value).run();
  }

  public insertInventoryItem(value: InventoryItem): void {
    this.transaction
      .insert(inventoryItems)
      .values({
        ...value,
        obtainedAt: nullableInstant(value.obtainedAt),
      })
      .run();
  }

  public findInventoryPlacement(id: string): InventoryPlacement | null {
    return (
      this.transaction
        .select({
          id: inventoryItems.id,
          status: inventoryItems.status,
          ownerCharacterId: inventoryItems.ownerCharacterId,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .get() ?? null
    );
  }

  public findEquipmentAssignment(inventoryItemId: string): EquipmentAssignment | null {
    return (
      this.transaction
        .select()
        .from(equipment)
        .where(eq(equipment.inventoryItemId, inventoryItemId))
        .get() ?? null
    );
  }

  public findEquipmentAssignmentAtSlot(
    characterId: string,
    slot: EquipmentAssignment["slot"],
  ): EquipmentAssignment | null {
    return (
      this.transaction
        .select()
        .from(equipment)
        .where(and(eq(equipment.characterId, characterId), eq(equipment.slot, slot)))
        .get() ?? null
    );
  }

  public setInventoryPlacement(value: InventoryPlacement): boolean {
    const current = this.transaction
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, value.id))
      .get();
    if (current?.status === value.status && current.ownerCharacterId === value.ownerCharacterId)
      return false;
    return (
      this.transaction
        .update(inventoryItems)
        .set({ status: value.status, ownerCharacterId: value.ownerCharacterId })
        .where(eq(inventoryItems.id, value.id))
        .run().changes > 0
    );
  }

  public setEquipment(value: EquipmentAssignment): boolean {
    const current = this.transaction
      .select()
      .from(equipment)
      .where(eq(equipment.inventoryItemId, value.inventoryItemId))
      .get();
    if (current?.characterId === value.characterId && current.slot === value.slot) return false;
    this.transaction
      .insert(equipment)
      .values(value)
      .onConflictDoUpdate({
        target: equipment.inventoryItemId,
        set: { characterId: value.characterId, slot: value.slot },
      })
      .run();
    return true;
  }

  public removeEquipment(inventoryItemId: string): boolean {
    return (
      this.transaction.delete(equipment).where(eq(equipment.inventoryItemId, inventoryItemId)).run()
        .changes > 0
    );
  }

  public insertSpell(value: Spell): void {
    this.transaction.insert(spells).values(value).run();
  }

  public setCharacterSpell(value: CharacterSpell): boolean {
    const key = and(
      eq(characterSpells.characterId, value.characterId),
      eq(characterSpells.spellId, value.spellId),
      eq(characterSpells.source, value.source),
    );
    const current = this.transaction.select().from(characterSpells).where(key).get();
    if (
      current?.known === value.known &&
      current.prepared === value.prepared &&
      current.alwaysPrepared === value.alwaysPrepared &&
      current.notes === value.notes
    )
      return false;
    this.transaction
      .insert(characterSpells)
      .values(value)
      .onConflictDoUpdate({
        target: [characterSpells.characterId, characterSpells.spellId, characterSpells.source],
        set: {
          known: value.known,
          prepared: value.prepared,
          alwaysPrepared: value.alwaysPrepared,
          notes: value.notes,
        },
      })
      .run();
    return true;
  }

  public insertAbility(value: Ability): void {
    this.transaction.insert(abilities).values(value).run();
  }

  public setCharacterAbility(value: CharacterAbility): boolean {
    const key = and(
      eq(characterAbilities.characterId, value.characterId),
      eq(characterAbilities.abilityId, value.abilityId),
      eq(characterAbilities.source, value.source),
    );
    const current = this.transaction.select().from(characterAbilities).where(key).get();
    if (current?.levelAcquired === value.levelAcquired && current.notes === value.notes)
      return false;
    this.transaction
      .insert(characterAbilities)
      .values(value)
      .onConflictDoUpdate({
        target: [
          characterAbilities.characterId,
          characterAbilities.abilityId,
          characterAbilities.source,
        ],
        set: { levelAcquired: value.levelAcquired, notes: value.notes },
      })
      .run();
    return true;
  }

  public insertIllithidPower(value: IllithidPower): void {
    this.transaction.insert(illithidPowers).values(value).run();
  }

  public setIllithidPrerequisite(value: IllithidPowerPrerequisite): boolean {
    const result = this.transaction
      .insert(illithidPowerPrerequisites)
      .values(value)
      .onConflictDoNothing()
      .run();
    return result.changes > 0;
  }

  public setCharacterIllithidPower(value: CharacterIllithidPower): boolean {
    const key = and(
      eq(characterIllithidPowers.characterId, value.characterId),
      eq(characterIllithidPowers.powerId, value.powerId),
    );
    const current = this.transaction.select().from(characterIllithidPowers).where(key).get();
    const acquiredAt = nullableInstant(value.acquiredAt);
    if (
      current?.acquiredAt === acquiredAt &&
      current.acquisitionSourcePl === value.acquisitionSourcePl &&
      current.notes === value.notes
    )
      return false;
    this.transaction
      .insert(characterIllithidPowers)
      .values({ ...value, acquiredAt })
      .onConflictDoUpdate({
        target: [characterIllithidPowers.characterId, characterIllithidPowers.powerId],
        set: { acquiredAt, acquisitionSourcePl: value.acquisitionSourcePl, notes: value.notes },
      })
      .run();
    return true;
  }
}
