import type {
  Character,
  CharacterAttribute,
  PermanentModifier,
} from "../../domain/model/campaign.js";
import type { IdSource } from "../../domain/mutations/campaign-mutation.js";
import type { CampaignImportState } from "./campaign-import-state.js";
import type { ImportReportEntry } from "./import-contracts.js";
import type { NormalizedLegacyCampaign } from "./legacy-campaign-normalizer.js";
import type { NormalizedLegacyCharacter } from "./legacy-character-normalizer.js";

export interface PlannedCharacterInsert {
  readonly id: string;
  readonly fact: NormalizedLegacyCharacter;
}
export type PlannedAttributeInsert = CharacterAttribute;
export interface PlannedModifierInsert {
  readonly id: string;
  readonly characterId: string;
  readonly fact: NonNullable<NormalizedLegacyCharacter["permanentStrengthModifier"]>;
}
export interface LegacyCharacterImportPlan {
  readonly characters: readonly PlannedCharacterInsert[];
  readonly attributes: readonly PlannedAttributeInsert[];
  readonly permanentModifiers: readonly PlannedModifierInsert[];
  readonly characterIdsByCanonicalName: ReadonlyMap<string, string>;
  readonly entries: readonly ImportReportEntry[];
  readonly blocked: boolean;
}

export function planLegacyCharacterImport(
  campaign: NormalizedLegacyCampaign,
  state: CampaignImportState,
  ids: IdSource,
): LegacyCharacterImportPlan {
  const characters: PlannedCharacterInsert[] = [];
  const attributes: PlannedAttributeInsert[] = [];
  const permanentModifiers: PlannedModifierInsert[] = [];
  const characterIdsByCanonicalName = new Map<string, string>();
  const entries: ImportReportEntry[] = [];
  const existingByName = new Map(state.characters.map((value) => [value.canonicalName, value]));

  for (const fact of campaign.characters) {
    const existing = existingByName.get(fact.canonicalName);
    const characterId = existing?.id ?? ids.nextId();
    characterIdsByCanonicalName.set(fact.canonicalName, characterId);
    if (existing === undefined) {
      characters.push({ id: characterId, fact });
      entries.push(report(fact, "character", "inserted", "CHARACTER_INSERT_PLANNED", characterId));
    } else if (characterEquals(existing, fact)) {
      entries.push(report(fact, "character", "matched", "CHARACTER_EXACT_MATCH", characterId));
    } else {
      entries.push(
        report(fact, "character", "conflicts", "CHARACTER_FACT_CONFLICT", characterId, true),
      );
      continue;
    }
    if (fact.pactVariantPl !== null)
      entries.push({
        ...report(fact, "character", "skipped", "PACT_VARIANT_NOT_A_CHARACTER_COLUMN", characterId),
        source: { ...fact.source, field: "Pakt / wariant" },
        messagePl: "Wariant paktu pozostaje w faktach wejściowych; nie jest kolumną postaci M1.",
      });

    for (const [attribute, baseValue] of Object.entries(fact.attributes) as [
      CharacterAttribute["attribute"],
      number,
    ][]) {
      const current = state.characterAttributes.find(
        (value) => value.characterId === characterId && value.attribute === attribute,
      );
      if (current === undefined) {
        attributes.push({ characterId, attribute, baseValue });
        entries.push(
          report(
            fact,
            "attribute",
            "inserted",
            "ATTRIBUTE_INSERT_PLANNED",
            characterId,
            false,
            attribute,
          ),
        );
      } else if (current.baseValue === baseValue) {
        entries.push(
          report(
            fact,
            "attribute",
            "matched",
            "ATTRIBUTE_EXACT_MATCH",
            characterId,
            false,
            attribute,
          ),
        );
      } else {
        entries.push(
          report(
            fact,
            "attribute",
            "conflicts",
            "ATTRIBUTE_FACT_CONFLICT",
            characterId,
            true,
            attribute,
          ),
        );
      }
    }

    if (fact.permanentStrengthModifier !== null) {
      const matches = state.permanentModifiers.filter((value) =>
        modifierEquals(value, characterId, fact.permanentStrengthModifier!),
      );
      const competing = state.permanentModifiers.filter(
        (value) =>
          value.characterId === characterId &&
          value.targetType === "ATTRIBUTE" &&
          value.targetKey === "STR" &&
          value.active &&
          value.permanent,
      );
      if (matches.length === 1) {
        entries.push(
          report(fact, "permanent_modifier", "matched", "MODIFIER_EXACT_MATCH", matches[0]!.id),
        );
      } else if (matches.length > 1 || competing.length > 0) {
        entries.push(
          report(
            fact,
            "permanent_modifier",
            "conflicts",
            "MODIFIER_FACT_CONFLICT",
            characterId,
            true,
          ),
        );
      } else {
        const id = ids.nextId();
        permanentModifiers.push({ id, characterId, fact: fact.permanentStrengthModifier });
        entries.push(report(fact, "permanent_modifier", "inserted", "MODIFIER_INSERT_PLANNED", id));
      }
    }
  }
  return {
    characters,
    attributes,
    permanentModifiers,
    characterIdsByCanonicalName,
    entries: sortEntries(entries),
    blocked:
      campaign.issues.some((value) => value.blocking) ||
      entries.some((value) => value.category === "conflicts"),
  };
}

export function materializeCharacter(value: PlannedCharacterInsert, occurredAt: Date): Character {
  const fact = value.fact;
  return {
    id: value.id,
    canonicalName: fact.canonicalName,
    displayNamePl: fact.displayNamePl,
    racePl: fact.racePl,
    classPl: fact.classPl,
    subclassPl: fact.subclassPl,
    level: fact.level,
    roleSummary: fact.roleSummary,
    activeParty: fact.activeParty,
    notes: fact.notes,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

export function materializeModifier(
  value: PlannedModifierInsert,
  occurredAt: Date,
): PermanentModifier {
  return {
    id: value.id,
    characterId: value.characterId,
    targetType: "ATTRIBUTE",
    targetKey: "STR",
    modifier: value.fact.modifier,
    sourceNamePl: value.fact.sourceNamePl,
    sourceItemDefinitionId: null,
    provenanceType: value.fact.provenanceType,
    permanent: value.fact.permanent,
    active: value.fact.active,
    notes: value.fact.notes,
    createdAt: occurredAt,
  };
}

function characterEquals(current: Character, fact: NormalizedLegacyCharacter): boolean {
  return (
    current.canonicalName === fact.canonicalName &&
    current.displayNamePl === fact.displayNamePl &&
    current.racePl === fact.racePl &&
    current.classPl === fact.classPl &&
    current.subclassPl === fact.subclassPl &&
    current.level === fact.level &&
    current.roleSummary === fact.roleSummary &&
    current.activeParty === fact.activeParty &&
    current.notes === fact.notes
  );
}

function modifierEquals(
  current: PermanentModifier,
  characterId: string,
  fact: NonNullable<NormalizedLegacyCharacter["permanentStrengthModifier"]>,
): boolean {
  return (
    current.characterId === characterId &&
    current.targetType === "ATTRIBUTE" &&
    current.targetKey === "STR" &&
    current.modifier === fact.modifier &&
    current.sourceNamePl === fact.sourceNamePl &&
    current.provenanceType === fact.provenanceType &&
    current.permanent === fact.permanent &&
    current.active === fact.active &&
    current.notes === fact.notes
  );
}

function report(
  fact: NormalizedLegacyCharacter,
  entityKind: ImportReportEntry["entityKind"],
  category: ImportReportEntry["category"],
  reasonCode: string,
  canonicalEntityId: string,
  blocking = false,
  field: string | null = null,
): ImportReportEntry {
  return {
    category,
    entityKind,
    source: { ...fact.source, field },
    sourceKey: fact.sourceKey,
    reasonCode,
    messagePl: message(reasonCode),
    blocking,
    canonicalEntityId,
    relatedIds: [],
  };
}

function message(code: string): string {
  const values: Readonly<Record<string, string>> = {
    CHARACTER_INSERT_PLANNED: "Postać zostanie dodana.",
    CHARACTER_EXACT_MATCH: "Postać jest już zgodna.",
    CHARACTER_FACT_CONFLICT: "Istniejąca postać ma sprzeczne fakty.",
    ATTRIBUTE_INSERT_PLANNED: "Atrybut zostanie dodany.",
    ATTRIBUTE_EXACT_MATCH: "Atrybut jest już zgodny.",
    ATTRIBUTE_FACT_CONFLICT: "Istniejący atrybut ma inną wartość.",
    MODIFIER_INSERT_PLANNED: "Stały modyfikator zostanie dodany.",
    MODIFIER_EXACT_MATCH: "Stały modyfikator jest już zgodny.",
    MODIFIER_FACT_CONFLICT: "Istniejący stały modyfikator jest sprzeczny.",
  };
  return values[code] ?? "Fakt importu został sklasyfikowany.";
}

function sortEntries(entries: readonly ImportReportEntry[]): readonly ImportReportEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.source.row - b.source.row ||
      a.entityKind.localeCompare(b.entityKind, "pl-PL") ||
      (a.source.field ?? "").localeCompare(b.source.field ?? "", "pl-PL"),
  );
}
