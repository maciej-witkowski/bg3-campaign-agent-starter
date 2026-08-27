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
      writes.insertItemDefinition(value);
      return true;
    });
  }

  public addEffect(value: ItemEffect, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
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
      const placements = new Map(change.items.map((item) => [item.id, item]));
      const assignments = new Map(
        change.assignments.map((assignment) => [assignment.inventoryItemId, assignment]),
      );
      const equipmentItemIds = new Set([...placements.keys(), ...assignments.keys()]);
      const placementUnchanged = [...placements.values()].every((placement) =>
        inventoryPlacementEquals(writes.findInventoryPlacement(placement.id), placement),
      );
      const equipmentUnchanged = [...equipmentItemIds].every((inventoryItemId) =>
        equipmentAssignmentEquals(
          writes.findEquipmentAssignment(inventoryItemId),
          assignments.get(inventoryItemId) ?? null,
        ),
      );
      if (placementUnchanged && equipmentUnchanged) return false;

      let changed = false;
      for (const item of change.items) changed = writes.removeEquipment(item.id) || changed;
      for (const item of change.items) changed = writes.setInventoryPlacement(item) || changed;
      for (const assignment of change.assignments) {
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
      writes.insertSpell(value);
      return true;
    });
  }

  public setSpell(value: CharacterSpell, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) =>
      writes.setCharacterSpell(value),
    );
  }

  public createAbility(value: Ability, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
      writes.insertAbility(value);
      return true;
    });
  }

  public setAbility(value: CharacterAbility, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) => {
      requiredNullableIntegerInRange(value.levelAcquired, 1, 20, "levelAcquired");
      return writes.setCharacterAbility(value);
    });
  }

  public createIllithidPower(value: IllithidPower, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
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
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) =>
      writes.setCharacterIllithidPower(value),
    );
  }
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
