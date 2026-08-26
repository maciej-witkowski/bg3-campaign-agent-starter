import type {
  Ability,
  Character,
  CharacterAbility,
  CharacterAttribute,
  CharacterIllithidPower,
  CharacterSpell,
  EquipmentAssignment,
  IllithidPower,
  IllithidPowerPrerequisite,
  InventoryItem,
  ItemDefinition,
  ItemEffect,
  PermanentModifier,
  Spell,
} from "../model/campaign.js";
import type {
  CampaignMutationCoordinatorPort,
  CampaignMutationMetadata,
  CampaignMutationResult,
} from "../mutations/campaign-mutation.js";

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
  readonly items: readonly InventoryItem[];
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
    return this.coordinator.execute({ ...metadata, characterId: value.characterId }, (writes) =>
      writes.setCharacterAbility(value),
    );
  }

  public createIllithidPower(value: IllithidPower, metadata: Metadata): CampaignMutationResult {
    return this.coordinator.execute(metadata, (writes) => {
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
