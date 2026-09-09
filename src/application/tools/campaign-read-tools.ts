import type { z } from "zod";

import type {
  CampaignInspectionReadPort,
  CampaignInspectionReadSession,
  InventoryItemView,
} from "../inspection/campaign-inspection.js";
import { CampaignInspectionService } from "../inspection/campaign-inspection-service.js";
import type { CampaignValidationService } from "../inspection/campaign-validation-service.js";
import { EQUIPMENT_SLOTS, type EquipmentSlot } from "../../domain/model/campaign.js";
import { normalizePolishMatchingKey } from "../../domain/naming/polish-matching.js";
import { isEquipmentSlotCompatible } from "../../domain/validation/campaign-validation.js";
import type {
  CalculateEffectiveAttributesInput,
  CompareEquipmentInput,
  FindEquipmentCandidatesInput,
  FindInventoryItemsInput,
  GetCharacterBuildInput,
  GetCharacterEquipmentInput,
  GetCharacterInput,
  GetCharacterSpellsInput,
  GetIllithidStateInput,
  GetItemInput,
  GetPartyInput,
  GetRecentChangesInput,
  ValidateCampaignStateInput,
} from "../../tools/contracts/tool-input-contracts.js";
import type {
  calculateEffectiveAttributesOutputSchema,
  compareEquipmentOutputSchema,
  findEquipmentCandidatesOutputSchema,
  findInventoryItemsOutputSchema,
  getCharacterBuildOutputSchema,
  getCharacterEquipmentOutputSchema,
  getCharacterOutputSchema,
  getCharacterSpellsOutputSchema,
  getIllithidStateOutputSchema,
  getItemOutputSchema,
  getPartyOutputSchema,
  getRecentChangesOutputSchema,
  validateCampaignStateOutputSchema,
} from "../../tools/contracts/read-tool-output-contracts.js";

export interface CampaignReadToolPort {
  getParty(input: GetPartyInput): z.infer<typeof getPartyOutputSchema>;
  getCharacter(input: GetCharacterInput): z.infer<typeof getCharacterOutputSchema>;
  getCharacterBuild(input: GetCharacterBuildInput): z.infer<typeof getCharacterBuildOutputSchema>;
  getCharacterEquipment(
    input: GetCharacterEquipmentInput,
  ): z.infer<typeof getCharacterEquipmentOutputSchema>;
  findInventoryItems(
    input: FindInventoryItemsInput,
  ): z.infer<typeof findInventoryItemsOutputSchema>;
  getItem(input: GetItemInput): z.infer<typeof getItemOutputSchema>;
  getCharacterSpells(
    input: GetCharacterSpellsInput,
  ): z.infer<typeof getCharacterSpellsOutputSchema>;
  getIllithidState(input: GetIllithidStateInput): z.infer<typeof getIllithidStateOutputSchema>;
  getRecentChanges(input: GetRecentChangesInput): z.infer<typeof getRecentChangesOutputSchema>;
  compareEquipment(input: CompareEquipmentInput): z.infer<typeof compareEquipmentOutputSchema>;
  calculateEffectiveAttributes(
    input: CalculateEffectiveAttributesInput,
  ): z.infer<typeof calculateEffectiveAttributesOutputSchema>;
  findEquipmentCandidates(
    input: FindEquipmentCandidatesInput,
  ): z.infer<typeof findEquipmentCandidatesOutputSchema>;
  validateCampaignState(
    input: ValidateCampaignStateInput,
  ): z.infer<typeof validateCampaignStateOutputSchema>;
}

export class CampaignToolQueryError extends Error {
  public override readonly name = "CampaignToolQueryError";
  public constructor(
    public readonly code: "NOT_FOUND" | "AMBIGUOUS" | "INVALID_FILTER" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

export class CampaignReadToolService implements CampaignReadToolPort {
  public constructor(
    private readonly inspectionSource: CampaignInspectionReadPort,
    private readonly validation: CampaignValidationService,
  ) {}

  public getParty() {
    const view = this.snapshot().inspection.getParty();
    return {
      characters: view.characters.map((value) => ({
        ...identity(value),
        class_pl: value.classPl,
        subclass_pl: value.subclassPl,
        level: value.level,
        role_summary: value.roleSummary,
        attributes: value.attributes.map(attribute),
      })),
    };
  }

  public getCharacter(input: GetCharacterInput) {
    return characterOutput(this.snapshot().inspection.getCharacter(input.character));
  }

  public getCharacterBuild(input: GetCharacterBuildInput) {
    const snapshot = this.snapshot();
    const character = snapshot.inspection.getCharacter(input.character);
    const spells = snapshot.inspection.getSpells(input.character);
    return {
      ...characterOutput(character),
      abilities: character.abilities.map(({ assignment, definition }) => ({
        id: definition.id,
        name_pl: definition.namePl,
        name_en: definition.nameEn,
        type: definition.type,
        description_pl: definition.descriptionPl,
        verification_status: definition.verificationStatus,
        source: assignment.source,
        level_acquired: assignment.levelAcquired,
        notes: assignment.notes,
      })),
      spells: spells.spells.map(spell),
    };
  }

  public getCharacterEquipment(input: GetCharacterEquipmentInput) {
    const result = this.snapshot().inspection.getEquipment(input.character);
    return {
      character: identity(result.character),
      items: result.items.map((item) => inventory(item, result.character)),
    };
  }

  public findInventoryItems(input: FindInventoryItemsInput) {
    const snapshot = this.snapshot();
    const filters = {
      ...(input.status === undefined ? {} : { statuses: input.status }),
      ...(input.slot === undefined ? {} : { slots: [input.slot as never] }),
      ...(input.tags === undefined ? {} : { tags: input.tags }),
    };
    let items = snapshot.inspection.findInventory(filters).items;
    if (input.owner !== undefined) {
      const owner = snapshot.inspection.getCharacter(input.owner).character.id;
      items = items.filter((item) => item.inventoryItem.ownerCharacterId === owner);
    }
    if (input.query !== undefined && input.query.trim() !== "") {
      const key = normalizePolishMatchingKey(input.query);
      items = items.filter((item) =>
        normalizePolishMatchingKey(item.definition.namePl).includes(key),
      );
    }
    return { items: items.map((item) => inventory(item, item.owner)) };
  }

  public getItem(input: GetItemInput) {
    const snapshot = this.snapshot();
    const all = snapshot.inspection.findInventory().items;
    const definition = resolveDefinition(snapshot.session.listItemDefinitions(), input.item);
    return {
      definition: itemDefinition(definition),
      instances: all
        .filter((item) => item.definition.id === definition.id)
        .map((item) => inventory(item, item.owner)),
    };
  }

  public getCharacterSpells(input: GetCharacterSpellsInput) {
    const result = this.snapshot().inspection.getSpells(input.character);
    const values = result.spells.filter(
      ({ assignment }) =>
        (input.known === undefined || assignment.known === input.known) &&
        (input.prepared === undefined || assignment.prepared === input.prepared) &&
        (input.source === undefined || assignment.source === input.source),
    );
    return { character: identity(result.character), spells: values.map(spell) };
  }

  public getIllithidState(input: GetIllithidStateInput) {
    const result = this.snapshot().inspection.getIllithid(input.character);
    return {
      character: result.character === null ? null : identity(result.character),
      powers: result.powers.map(({ definition, prerequisitePowerIds, acquisition }) => ({
        id: definition.id,
        name_pl: definition.namePl,
        name_en: definition.nameEn,
        tier: definition.tier,
        description_pl: definition.descriptionPl,
        verification_status: definition.verificationStatus,
        prerequisite_power_ids: [...prerequisitePowerIds],
        acquired: result.character === null ? null : acquisition !== null,
        acquired_at: date(acquisition?.acquiredAt ?? null),
        acquisition_source_pl: acquisition?.acquisitionSourcePl ?? null,
        notes: acquisition?.notes ?? null,
      })),
    };
  }

  public getRecentChanges(input: GetRecentChangesInput) {
    const result = this.snapshot().inspection.getChanges(input.limit);
    return {
      limit: result.limit,
      changes: result.changes.map((value) => ({
        id: value.id,
        occurred_at: value.occurredAt.toISOString(),
        type: value.type,
        character_id: value.characterId,
        checkpoint_id: value.checkpointId,
        proposal_id: value.proposalId,
        summary_pl: value.summaryPl,
        reason_pl: value.reasonPl,
        reverses_change_event_id: value.reversesChangeEventId,
      })),
    };
  }

  public compareEquipment(input: CompareEquipmentInput) {
    const snapshot = this.snapshot();
    const character = snapshot.inspection.getCharacter(input.character).character;
    const all = snapshot.inspection.findInventory().items;
    const candidate = resolveInstance(all, input.candidate_item);
    const slot = input.slot === undefined ? null : equipmentSlot(input.slot);
    if (
      slot !== null &&
      (candidate.definition.slot === null ||
        !isEquipmentSlotCompatible(slot, candidate.definition.slot))
    ) {
      throw new CampaignToolQueryError(
        "CONFLICT",
        "Kandydat nie ma potwierdzonej zgodności z wybranym slotem wyposażenia.",
      );
    }
    const current = snapshot.inspection
      .getEquipment(character.canonicalName)
      .items.filter((item) =>
        slot === null
          ? candidate.definition.slot !== null &&
            isEquipmentSlotCompatible(item.assignment.slot, candidate.definition.slot)
          : item.assignment.slot === slot,
      )
      .map((item) => inventory(item, character));
    const party = input.include_party_synergies
      ? snapshot.inspection.getParty().characters.map((member) => {
          const equipment = snapshot.inspection.getEquipment(member.canonicalName);
          return {
            character: identity(member),
            items: equipment.items.map((item) => inventory(item, member)),
          };
        })
      : [];
    return {
      character: identity(character),
      candidate: inventory(candidate, candidate.owner),
      currently_equipped: current,
      include_party_synergies: input.include_party_synergies,
      party_equipment: party,
    };
  }

  public calculateEffectiveAttributes(input: CalculateEffectiveAttributesInput) {
    const result = this.snapshot().inspection.getCharacter(input.character);
    return { character: identity(result.character), attributes: result.attributes.map(attribute) };
  }

  public findEquipmentCandidates(input: FindEquipmentCandidatesInput) {
    const snapshot = this.snapshot();
    const character = snapshot.inspection.getCharacter(input.character).character;
    const slot = equipmentSlot(input.slot);
    const effects = input.effect_types ?? [];
    const normalizedEffects = effects.map(normalizePolishMatchingKey);
    const items = snapshot.inspection
      .findInventory()
      .items.filter(
        (item) =>
          item.inventoryItem.status !== "SOLD" &&
          (item.inventoryItem.status !== "PERSONAL_STORY" ||
            item.inventoryItem.ownerCharacterId === character.id) &&
          item.definition.slot !== null &&
          isEquipmentSlotCompatible(slot, item.definition.slot) &&
          normalizedEffects.every((wanted) =>
            item.effects.some((effect) => normalizePolishMatchingKey(effect.effectType) === wanted),
          ),
      );
    return {
      character: identity(character),
      slot,
      effect_types: [...effects],
      items: items.map((item) => inventory(item, item.owner)),
    };
  }

  public validateCampaignState() {
    const result = this.validation.validate();
    return {
      valid: result.valid,
      violations: result.violations.map((value) => ({
        code: value.code,
        message: value.message,
        entity_ids: [...value.entityIds],
      })),
    };
  }

  private snapshot(): {
    inspection: CampaignInspectionService;
    session: CampaignInspectionReadSession;
  } {
    return this.inspectionSource.read((session) => {
      const snapshot = captureSession(session);
      return {
        inspection: new CampaignInspectionService({ read: (operation) => operation(snapshot) }),
        session: snapshot,
      };
    });
  }
}

function captureSession(session: CampaignInspectionReadSession): CampaignInspectionReadSession {
  const characters = session.listCharacters();
  const attributes = new Map(characters.map((c) => [c.id, session.listCharacterAttributes(c.id)]));
  const modifiers = new Map(characters.map((c) => [c.id, session.listPermanentModifiers(c.id)]));
  const characterAbilities = new Map(
    characters.map((c) => [c.id, session.listCharacterAbilities(c.id)]),
  );
  const characterSpells = new Map(characters.map((c) => [c.id, session.listCharacterSpells(c.id)]));
  const acquisitions = new Map(
    characters.map((c) => [c.id, session.listCharacterIllithidPowers(c.id)]),
  );
  const equipment = session.listEquipment();
  const abilities = session.listAbilities();
  const itemDefinitions = session.listItemDefinitions();
  const itemEffects = session.listItemEffects();
  const inventoryItems = session.listInventoryItems();
  const spells = session.listSpells();
  const illithidPowers = session.listIllithidPowers();
  const illithidPrerequisites = session.listIllithidPrerequisites();
  const recentChanges = session.listRecentChanges(1_000);
  return {
    listCharacters: () => characters,
    listCharacterAttributes: (id) => attributes.get(id) ?? [],
    listPermanentModifiers: (id) => modifiers.get(id) ?? [],
    listAbilities: () => abilities,
    listCharacterAbilities: (id) => characterAbilities.get(id) ?? [],
    listItemDefinitions: () => itemDefinitions,
    listItemEffects: () => itemEffects,
    listInventoryItems: () => inventoryItems,
    listEquipment: (id) =>
      id === undefined ? equipment : equipment.filter((v) => v.characterId === id),
    listSpells: () => spells,
    listCharacterSpells: (id) => characterSpells.get(id) ?? [],
    listIllithidPowers: () => illithidPowers,
    listIllithidPrerequisites: () => illithidPrerequisites,
    listCharacterIllithidPowers: (id) => acquisitions.get(id) ?? [],
    listRecentChanges: (limit) => recentChanges.slice(0, limit),
  };
}

function identity(value: { id: string; canonicalName: string; displayNamePl: string }) {
  return {
    id: value.id,
    canonical_name: value.canonicalName,
    display_name_pl: value.displayNamePl,
  };
}
function attribute(value: {
  attribute: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  baseValue: number;
  effectiveValue: number;
}) {
  return {
    attribute: value.attribute,
    base_value: value.baseValue,
    effective_value: value.effectiveValue,
  };
}
function characterOutput(view: ReturnType<CampaignInspectionService["getCharacter"]>) {
  const c = view.character;
  return {
    character: {
      ...identity(c),
      race_pl: c.racePl,
      class_pl: c.classPl,
      subclass_pl: c.subclassPl,
      level: c.level,
      role_summary: c.roleSummary,
      active_party: c.activeParty,
    },
    attributes: view.attributes.map(attribute),
    permanent_modifiers: view.permanentModifiers.map((m) => ({
      id: m.id,
      target_key: m.targetKey,
      modifier: m.modifier,
      source_name_pl: m.sourceNamePl,
      provenance_type: m.provenanceType,
      permanent: m.permanent,
      active: m.active,
      notes: m.notes,
      created_at: m.createdAt.toISOString(),
    })),
  };
}
function itemDefinition(d: InventoryItemView["definition"]) {
  return {
    id: d.id,
    name_pl: d.namePl,
    name_en: d.nameEn,
    type_pl: d.typePl,
    slot: d.slot,
    rarity_pl: d.rarityPl,
    description_pl: d.descriptionPl,
    verification_status: d.verificationStatus,
    verification_confidence: d.verificationConfidence,
    verification_source: d.verificationSource,
    notes: d.notes,
  };
}
function effect(e: InventoryItemView["effects"][number]) {
  return {
    id: e.id,
    effect_type: e.effectType,
    numeric_value: e.numericValue,
    dice_expression: e.diceExpression,
    damage_type: e.damageType,
    trigger: e.trigger,
    condition_text_pl: e.conditionTextPl,
    duration_text_pl: e.durationTextPl,
    description_pl: e.descriptionPl,
    verification_status: e.verificationStatus,
  };
}
function inventory(
  view: InventoryItemView | ReturnType<CampaignInspectionService["getEquipment"]>["items"][number],
  owner: { id: string; canonicalName: string; displayNamePl: string } | null,
) {
  const i = view.inventoryItem;
  const assignment = "equipment" in view ? view.equipment : view.assignment;
  return {
    inventory_item: {
      id: i.id,
      status: i.status,
      owner_character_id: i.ownerCharacterId,
      quantity: i.quantity,
      obtained_at: date(i.obtainedAt),
      obtained_location: i.obtainedLocation,
      notes: i.notes,
    },
    definition: itemDefinition(view.definition),
    effects: view.effects.map(effect),
    owner: owner === null ? null : identity(owner),
    equipment:
      assignment === null
        ? null
        : {
            inventory_item_id: assignment.inventoryItemId,
            character_id: assignment.characterId,
            slot: assignment.slot,
          },
  };
}
function spell(view: ReturnType<CampaignInspectionService["getSpells"]>["spells"][number]) {
  const { assignment: a, definition: d } = view;
  return {
    id: d.id,
    name_pl: d.namePl,
    name_en: d.nameEn,
    level: d.level,
    school_pl: d.schoolPl,
    description_pl: d.descriptionPl,
    verification_status: d.verificationStatus,
    source: a.source,
    known: a.known,
    prepared: a.prepared,
    always_prepared: a.alwaysPrepared,
    notes: a.notes,
  };
}
function date(value: Date | null) {
  return value?.toISOString() ?? null;
}
function resolveDefinition(definitions: readonly InventoryItemView["definition"][], input: string) {
  const exactId = definitions.find((value) => value.id === input);
  if (exactId) return exactId;
  const key = normalizePolishMatchingKey(input);
  const matches = definitions.filter((value) => normalizePolishMatchingKey(value.namePl) === key);
  if (matches.length === 0)
    throw new CampaignToolQueryError("NOT_FOUND", "Nie znaleziono przedmiotu.");
  if (matches.length > 1)
    throw new CampaignToolQueryError("AMBIGUOUS", "Nazwa przedmiotu jest niejednoznaczna.");
  return matches[0]!;
}
function resolveInstance(items: readonly InventoryItemView[], input: string) {
  const exact = items.find((v) => v.inventoryItem.id === input);
  if (exact) return exact;
  const definition = resolveDefinition(
    items.map((value) => value.definition),
    input,
  );
  const matches = items.filter((v) => v.definition.id === definition.id);
  if (matches.length !== 1)
    throw new CampaignToolQueryError(
      "AMBIGUOUS",
      "Wskazanie pasuje do wielu egzemplarzy przedmiotu.",
    );
  return matches[0]!;
}
function equipmentSlot(value: string): EquipmentSlot {
  if (!(EQUIPMENT_SLOTS as readonly string[]).includes(value))
    throw new CampaignToolQueryError("INVALID_FILTER", "Nieprawidłowy slot wyposażenia.");
  return value as EquipmentSlot;
}
