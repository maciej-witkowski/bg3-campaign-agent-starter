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
} from "../model/campaign.js";
import { CampaignDomainError } from "../mutations/campaign-mutation.js";
import type {
  CampaignMutationCoordinatorPort,
  CampaignMutationMetadata,
  CampaignMutationResult,
  IdSource,
} from "../mutations/campaign-mutation.js";
import {
  calculateSnapshotSha256,
  deserializeCampaignSnapshot,
} from "../snapshots/campaign-snapshot.js";

type Metadata = Omit<CampaignMutationMetadata, "characterId" | "reversesChangeEventId">;

export class CharacterMutationService {
  public constructor(private readonly coordinator: CampaignMutationCoordinatorPort) {}

  public createCharacter(value: Character, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.id }, (writes) => {
      rejectBlankNullableText({
        racePl: value.racePl,
        subclassPl: value.subclassPl,
        notes: value.notes,
      });
      writes.insertCharacter(value);
      return true;
    });
  }

  public setAttribute(value: CharacterAttribute, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) =>
      writes.setCharacterAttribute(value),
    );
  }

  public addPermanentModifier(
    value: PermanentModifier,
    metadata: Metadata,
  ): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) => {
      rejectBlankNullableText({
        sourceItemDefinitionId: value.sourceItemDefinitionId,
        notes: value.notes,
      });
      writes.insertPermanentModifier(value);
      return true;
    });
  }
}

export interface CreateCheckpointInput {
  readonly label: string;
  readonly reasonPl: string;
  readonly changeEventId?: string | null;
}
export interface SnapshotDigestPort {
  calculate(payload: string): string;
}
export type CheckpointMutationResult =
  | { readonly changed: false }
  | {
      readonly changed: true;
      readonly changeEventId: string;
      readonly occurredAt: Date;
      readonly checkpointId: string;
    };

export class CheckpointMutationService {
  public constructor(
    private readonly coordinator: CampaignMutationCoordinatorPort,
    private readonly ids: IdSource,
    private readonly digest: SnapshotDigestPort = { calculate: calculateSnapshotSha256 },
  ) {}
  public createCheckpoint(
    input: CreateCheckpointInput,
    metadata: Metadata,
  ): CheckpointMutationResult {
    const checkpointId = this.ids.nextId();
    const result = this.coordinator.execute(metadata, (writes, context) => {
      const snapshotJson = context.snapshotter.capture();
      const snapshot = deserializeCampaignSnapshot(snapshotJson);
      rejectBlankNullableText({ changeEventId: input.changeEventId ?? null });
      if (input.changeEventId !== undefined && input.changeEventId !== null) {
        const referencedSnapshotJson = context.changeEventSnapshots.findAfterSnapshot(
          input.changeEventId,
        );
        if (referencedSnapshotJson === null)
          throw new CampaignDomainError("Powiązane zdarzenie zmiany nie istnieje.");
        const referencedSnapshot = deserializeCampaignSnapshot(referencedSnapshotJson);
        if (
          referencedSnapshot.schemaVersion !== snapshot.schemaVersion ||
          JSON.stringify(referencedSnapshot.state) !== JSON.stringify(snapshot.state)
        )
          throw new CampaignDomainError(
            "Checkpoint nie odpowiada stanowi po powiązanym zdarzeniu zmiany.",
          );
      }
      const checkpoint: Checkpoint = {
        id: checkpointId,
        label: requiredCheckpointText(input.label, "label"),
        createdAt: context.occurredAt,
        snapshotFormat: snapshot.format,
        snapshotVersion: snapshot.version,
        schemaVersion: snapshot.schemaVersion,
        snapshotJson,
        snapshotSha256: this.digest.calculate(snapshotJson),
        reasonPl: requiredCheckpointText(input.reasonPl, "reasonPl"),
        changeEventId: input.changeEventId ?? null,
      };
      writes.insertCheckpoint(checkpoint);
      return true;
    });
    return result.changed ? { ...result, checkpointId } : result;
  }
}
function requiredCheckpointText(value: string, field: string): string {
  if (value.trim() === "") throw new CampaignDomainError(`${field} nie może być puste.`);
  return value;
}

export class ItemCatalogMutationService {
  public constructor(private readonly coordinator: CampaignMutationCoordinatorPort) {}

  public createDefinition(value: ItemDefinition, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        nameEn: value.nameEn,
        typePl: value.typePl,
        rarityPl: value.rarityPl,
        descriptionPl: value.descriptionPl,
        verificationSource: value.verificationSource,
        fingerprint: value.fingerprint,
        notes: value.notes,
      });
      requiredNullableFiniteNumber(value.verificationConfidence, "verificationConfidence");
      writes.insertItemDefinition(value);
      return true;
    });
  }

  public addEffect(value: ItemEffect, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        diceExpression: value.diceExpression,
        damageType: value.damageType,
        trigger: value.trigger,
        conditionTextPl: value.conditionTextPl,
        durationTextPl: value.durationTextPl,
      });
      requiredNullableFiniteNumber(value.numericValue, "numericValue");
      writes.insertItemEffect(value);
      return true;
    });
  }
}

export interface InventoryEquipmentChange {
  readonly items: readonly InventoryPlacement[];
  readonly assignments: readonly EquipmentAssignment[];
}

export class InventoryMutationService {
  public constructor(private readonly coordinator: CampaignMutationCoordinatorPort) {}

  public addItem(value: InventoryItem, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        ownerCharacterId: value.ownerCharacterId,
        obtainedLocation: value.obtainedLocation,
        notes: value.notes,
      });
      writes.insertInventoryItem(value);
      return true;
    });
  }

  public setEquipment(
    change: InventoryEquipmentChange,
    metadata: Metadata,
  ): CampaignMutationResult {
    const characterIds = new Set(change.assignments.map((value) => value.characterId));
    const characterId =
      characterIds.size === 1 ? (characterIds.values().next().value ?? null) : null;
    return this.coordinator.execute({ ...metadata, characterId }, (writes) => {
      for (const item of change.items)
        rejectBlankNullableText({ ownerCharacterId: item.ownerCharacterId });
      const placements = new Map<string, InventoryPlacement>();
      for (const item of change.items) {
        const duplicate = placements.get(item.id);
        if (duplicate !== undefined && !inventoryPlacementEquals(duplicate, item))
          throw new CampaignDomainError("Sprzeczne położenia elementu ekwipunku.");
        placements.set(item.id, item);
      }
      const assignments = new Map<string, EquipmentAssignment>();
      for (const assignment of change.assignments) {
        const duplicate = assignments.get(assignment.inventoryItemId);
        if (duplicate !== undefined && !equipmentAssignmentEquals(duplicate, assignment))
          throw new CampaignDomainError("Sprzeczne przypisania elementu ekwipunku.");
        assignments.set(assignment.inventoryItemId, assignment);
      }
      const equipmentItemIds = new Set([...placements.keys(), ...assignments.keys()]);
      const desiredSlots = new Map<string, string>();
      for (const assignment of assignments.values()) {
        const slotKey = `${assignment.characterId}:${assignment.slot}`;
        const competingItemId = desiredSlots.get(slotKey);
        if (competingItemId !== undefined && competingItemId !== assignment.inventoryItemId)
          throw new CampaignDomainError("Sprzeczne przypisania do pozycji ekwipunku.");
        desiredSlots.set(slotKey, assignment.inventoryItemId);
        const currentOccupant = writes.findEquipmentAssignmentAtSlot(
          assignment.characterId,
          assignment.slot,
        );
        if (
          currentOccupant !== null &&
          currentOccupant.inventoryItemId !== assignment.inventoryItemId &&
          !equipmentItemIds.has(currentOccupant.inventoryItemId)
        )
          throw new CampaignDomainError(
            "Komenda nie obejmuje elementu zajmującego docelową pozycję ekwipunku.",
          );
      }
      const currentPlacements = new Map(
        [...equipmentItemIds].map((inventoryItemId) => {
          const placement = writes.findInventoryPlacement(inventoryItemId);
          if (placement === null) throw new CampaignDomainError("Element ekwipunku nie istnieje.");
          return [inventoryItemId, placement] as const;
        }),
      );
      const placementUnchanged = [...placements.values()].every((placement) =>
        inventoryPlacementEquals(currentPlacements.get(placement.id) ?? null, placement),
      );
      const equipmentUnchanged = [...equipmentItemIds].every((inventoryItemId) =>
        equipmentAssignmentEquals(
          writes.findEquipmentAssignment(inventoryItemId),
          assignments.get(inventoryItemId) ?? null,
        ),
      );
      if (placementUnchanged && equipmentUnchanged) return false;

      let changed = false;
      for (const inventoryItemId of equipmentItemIds)
        changed = writes.removeEquipment(inventoryItemId) || changed;
      for (const item of placements.values())
        changed = writes.setInventoryPlacement(item) || changed;
      for (const assignment of assignments.values()) {
        changed = writes.setEquipment(assignment) || changed;
      }
      return changed;
    });
  }
}

function inventoryPlacementEquals(
  current: InventoryPlacement | null,
  expected: InventoryPlacement,
): boolean {
  return (
    current?.id === expected.id &&
    current.status === expected.status &&
    current.ownerCharacterId === expected.ownerCharacterId
  );
}

function equipmentAssignmentEquals(
  current: EquipmentAssignment | null,
  expected: EquipmentAssignment | null,
): boolean {
  if (current === null || expected === null) return current === expected;
  return (
    current.inventoryItemId === expected.inventoryItemId &&
    current.characterId === expected.characterId &&
    current.slot === expected.slot
  );
}

export class CharacterCapabilityMutationService {
  public constructor(private readonly coordinator: CampaignMutationCoordinatorPort) {}

  public createSpell(value: Spell, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        nameEn: value.nameEn,
        schoolPl: value.schoolPl,
        descriptionPl: value.descriptionPl,
        notes: value.notes,
      });
      writes.insertSpell(value);
      return true;
    });
  }

  public setSpell(value: CharacterSpell, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) => {
      rejectBlankNullableText({ notes: value.notes });
      return writes.setCharacterSpell(value);
    });
  }

  public createAbility(value: Ability, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        nameEn: value.nameEn,
        descriptionPl: value.descriptionPl,
        notes: value.notes,
      });
      writes.insertAbility(value);
      return true;
    });
  }

  public setAbility(value: CharacterAbility, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) => {
      rejectBlankNullableText({ notes: value.notes });
      requiredNullableIntegerInRange(value.levelAcquired, 1, 20, "levelAcquired");
      return writes.setCharacterAbility(value);
    });
  }

  public createIllithidPower(value: IllithidPower, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      rejectBlankNullableText({
        nameEn: value.nameEn,
        descriptionPl: value.descriptionPl,
        notes: value.notes,
      });
      requiredNullableIntegerInRange(value.tier, 1, 10, "tier");
      writes.insertIllithidPower(value);
      return true;
    });
  }

  public setIllithidPrerequisite(
    value: IllithidPowerPrerequisite,
    metadata: Metadata,
  ): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => writes.setIllithidPrerequisite(value));
  }

  public setIllithidPower(
    value: CharacterIllithidPower,
    metadata: Metadata,
  ): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) => {
      rejectBlankNullableText({
        acquisitionSourcePl: value.acquisitionSourcePl,
        notes: value.notes,
      });
      return writes.setCharacterIllithidPower(value);
    });
  }
}

function rejectBlankNullableText(fields: Readonly<Record<string, string | null>>): void {
  for (const [field, value] of Object.entries(fields)) {
    if (value !== null && value.trim() === "")
      throw new CampaignDomainError(`${field} nie może być puste.`);
  }
}

function requiredNullableFiniteNumber(value: number | null, field: string): void {
  if (value !== null && !Number.isFinite(value))
    throw new CampaignDomainError(`${field} musi być skończoną liczbą.`);
}

function requiredNullableIntegerInRange(
  value: number | null,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (value !== null && (!Number.isInteger(value) || value < minimum || value > maximum))
    throw new CampaignDomainError(
      `${field} musi być liczbą całkowitą od ${minimum} do ${maximum}.`,
    );
}

export class AuditReversalMutationService {
  public constructor(private readonly coordinator: CampaignMutationCoordinatorPort) {}

  /** Records append-only reversal provenance; restore/undo state logic remains deferred to M6. */
  public recordReversal(reversedChangeEventId: string, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(
      { ...metadata, reversesChangeEventId: reversedChangeEventId },
      () => true,
    );
  }
}
