import type {
  Ability,
  CharacterAbility,
  CharacterIllithidPower,
  CharacterSpell,
  IllithidPower,
  IllithidPowerPrerequisite,
  Spell,
} from "../../domain/model/campaign.js";
import type { IdSource } from "../../domain/mutations/campaign-mutation.js";
import type { CampaignImportState } from "./campaign-import-state.js";
import type { ImportReportEntry, ImportSourceLocation } from "./import-contracts.js";
import type {
  NormalizedLegacyAbility,
  NormalizedLegacyIllithidPower,
  NormalizedLegacySpell,
} from "./legacy-capability-normalizer.js";
import type { NormalizedLegacyCampaign } from "./legacy-campaign-normalizer.js";
import type { LegacyCharacterImportPlan } from "./legacy-character-import-planner.js";
import { normalizePolishMatchingKey } from "./legacy-normalization.js";
import { findPlanningDecision, type ImportPlanningDecisions } from "./reconciliation-decisions.js";

export interface PlannedAbilityInsert {
  readonly id: string;
  readonly fact: NormalizedLegacyAbility;
}
export interface PlannedSpellInsert {
  readonly id: string;
  readonly fact: NormalizedLegacySpell;
}
export interface PlannedIllithidPowerInsert {
  readonly id: string;
  readonly fact: NormalizedLegacyIllithidPower;
}
export interface LegacyCapabilityImportPlan {
  readonly abilities: readonly PlannedAbilityInsert[];
  readonly characterAbilities: readonly CharacterAbility[];
  readonly spells: readonly PlannedSpellInsert[];
  readonly characterSpells: readonly CharacterSpell[];
  readonly illithidPowers: readonly PlannedIllithidPowerInsert[];
  readonly illithidPrerequisites: readonly IllithidPowerPrerequisite[];
  readonly characterIllithidPowers: readonly CharacterIllithidPower[];
  readonly entries: readonly ImportReportEntry[];
  readonly blocked: boolean;
}

export function planLegacyCapabilityImport(
  campaign: NormalizedLegacyCampaign,
  state: CampaignImportState,
  characters: LegacyCharacterImportPlan,
  ids: IdSource,
  decisions?: ImportPlanningDecisions,
): LegacyCapabilityImportPlan {
  const abilities: PlannedAbilityInsert[] = [];
  const characterAbilities: CharacterAbility[] = [];
  const spells: PlannedSpellInsert[] = [];
  const characterSpells: CharacterSpell[] = [];
  const powers: PlannedIllithidPowerInsert[] = [];
  const prerequisites: IllithidPowerPrerequisite[] = [];
  const characterPowers: CharacterIllithidPower[] = [];
  const entries: ImportReportEntry[] = [];

  for (const fact of campaign.abilities) {
    const candidates = state.abilities.filter(
      (value) => value.normalizedNamePl === fact.normalizedNamePl && value.type === fact.type,
    );
    const resolution = resolveDefinition(
      fact,
      candidates,
      ids,
      abilityEquals,
      "ability",
      entries,
      decisions,
    );
    if (resolution === null) continue;
    if (resolution.inserted) abilities.push({ id: resolution.id, fact });
    for (const assignment of fact.assignments) {
      const characterId = characters.characterIdsByCanonicalName.get(
        assignment.characterCanonicalName,
      );
      if (characterId === undefined) {
        entries.push(
          dependencyEntry(
            fact,
            assignment.location,
            "character_ability",
            "CHARACTER_DEPENDENCY_MISSING",
            decisions,
          ),
        );
        continue;
      }
      const desired: CharacterAbility = {
        characterId,
        abilityId: resolution.id,
        source: assignment.source,
        levelAcquired: assignment.levelAcquired,
        notes: assignment.notes,
      };
      const current = state.characterAbilities.filter(
        (value) =>
          value.characterId === characterId &&
          value.abilityId === resolution.id &&
          value.source === assignment.source,
      );
      classifyAssignment(
        fact,
        desired,
        current,
        characterAbilities,
        characterAbilityEquals,
        characterAbilityIdentityEquals,
        assignment.location,
        "character_ability",
        entries,
        decisions,
      );
    }
  }

  for (const fact of campaign.spells) {
    const candidates = state.spells.filter(
      (value) => value.normalizedNamePl === fact.normalizedNamePl && value.level === fact.level,
    );
    const resolution = resolveDefinition(
      fact,
      candidates,
      ids,
      spellEquals,
      "spell",
      entries,
      decisions,
    );
    if (resolution === null) continue;
    if (resolution.inserted) spells.push({ id: resolution.id, fact });
    for (const assignment of fact.assignments) {
      const characterId = characters.characterIdsByCanonicalName.get(
        assignment.characterCanonicalName,
      );
      if (characterId === undefined) {
        entries.push(
          dependencyEntry(
            fact,
            assignment.location,
            "character_spell",
            "CHARACTER_DEPENDENCY_MISSING",
            decisions,
          ),
        );
        continue;
      }
      const desired: CharacterSpell = {
        characterId,
        spellId: resolution.id,
        source: assignment.source,
        known: assignment.known,
        prepared: assignment.prepared,
        alwaysPrepared: assignment.alwaysPrepared,
        notes: assignment.notes,
      };
      const current = state.characterSpells.filter(
        (value) =>
          value.characterId === characterId &&
          value.spellId === resolution.id &&
          value.source === assignment.source,
      );
      classifyAssignment(
        fact,
        desired,
        current,
        characterSpells,
        characterSpellEquals,
        characterSpellIdentityEquals,
        assignment.location,
        "character_spell",
        entries,
        decisions,
      );
    }
  }

  const powerIds = new Map<string, string>();
  for (const fact of campaign.illithidPowers) {
    const candidates = state.illithidPowers.filter(
      (value) => value.normalizedNamePl === fact.normalizedNamePl && value.tier === fact.tier,
    );
    const resolution = resolveDefinition(
      fact,
      candidates,
      ids,
      powerEquals,
      "illithid_power",
      entries,
      decisions,
    );
    if (resolution === null) continue;
    powerIds.set(fact.normalizedNamePl, resolution.id);
    if (resolution.inserted) powers.push({ id: resolution.id, fact });
    for (const assignment of fact.assignments) {
      const characterId = characters.characterIdsByCanonicalName.get(
        assignment.characterCanonicalName,
      );
      if (characterId === undefined) {
        entries.push(
          dependencyEntry(
            fact,
            assignment.location,
            "character_illithid_power",
            "CHARACTER_DEPENDENCY_MISSING",
            decisions,
          ),
        );
        continue;
      }
      const desired: CharacterIllithidPower = {
        characterId,
        powerId: resolution.id,
        acquiredAt: null,
        acquisitionSourcePl: fact.legacyStatusPl,
        notes: assignment.notes,
      };
      const current = state.characterIllithidPowers.filter(
        (value) => value.characterId === characterId && value.powerId === resolution.id,
      );
      classifyAssignment(
        fact,
        desired,
        current,
        characterPowers,
        characterPowerEquals,
        characterPowerIdentityEquals,
        assignment.location,
        "character_illithid_power",
        entries,
        decisions,
      );
    }
  }
  for (const fact of campaign.illithidPowers) {
    if (fact.prerequisiteNamePl === null) continue;
    const powerId = powerIds.get(fact.normalizedNamePl);
    const prerequisitePowerId = powerIds.get(normalizePolishMatchingKey(fact.prerequisiteNamePl));
    if (powerId === undefined || prerequisitePowerId === undefined) {
      entries.push(
        dependencyEntry(
          fact,
          fact.source,
          "illithid_prerequisite",
          "PREREQUISITE_DEPENDENCY_MISSING",
          decisions,
        ),
      );
      continue;
    }
    const desired = { powerId, prerequisitePowerId };
    const current = state.illithidPowerPrerequisites.filter(
      (value) => value.powerId === powerId && value.prerequisitePowerId === prerequisitePowerId,
    );
    classifyAssignment(
      fact,
      desired,
      current,
      prerequisites,
      prerequisiteEquals,
      prerequisiteIdentityEquals,
      fact.source,
      "illithid_prerequisite",
      entries,
      decisions,
    );
  }

  return {
    abilities,
    characterAbilities,
    spells,
    characterSpells,
    illithidPowers: powers,
    illithidPrerequisites: prerequisites,
    characterIllithidPowers: characterPowers,
    entries: sortEntries(entries),
    blocked: characters.blocked || entries.some((value) => value.category === "conflicts"),
  };
}

type DefinitionFact =
  NormalizedLegacyAbility | NormalizedLegacySpell | NormalizedLegacyIllithidPower;
type Definition = Ability | Spell | IllithidPower;
function resolveDefinition<F extends DefinitionFact, D extends Definition>(
  fact: F,
  candidates: readonly D[],
  ids: IdSource,
  equals: (value: D, fact: F) => boolean,
  kind: "ability" | "spell" | "illithid_power",
  entries: ImportReportEntry[],
  decisions?: ImportPlanningDecisions,
): { readonly id: string; readonly inserted: boolean } | null {
  if (candidates.length === 0) {
    const id = ids.nextId();
    entries.push(entry(fact, kind, "inserted", "CAPABILITY_DEFINITION_INSERT_PLANNED", id));
    return { id, inserted: true };
  }
  if (candidates.length > 1) {
    const decision = findPlanningDecision(
      decisions,
      kind,
      fact.source,
      "CAPABILITY_DEFINITION_AMBIGUOUS",
    );
    if (decision?.action === "select_existing") {
      entries.push(
        entry(fact, kind, "matched", "RECONCILED_SELECT_EXISTING", decision.canonicalEntityId),
      );
      return { id: decision.canonicalEntityId, inserted: false };
    }
    if (decision?.action === "treat_as_new") {
      const id = ids.nextId();
      entries.push(entry(fact, kind, "inserted", "RECONCILED_TREAT_AS_NEW", id));
      return { id, inserted: true };
    }
    if (decision?.action === "skip") {
      entries.push(entry(fact, kind, "skipped", "RECONCILED_SKIP", null));
      return null;
    }
    entries.push({
      ...entry(fact, kind, "ambiguous", "CAPABILITY_DEFINITION_AMBIGUOUS", null),
      relatedIds: candidates.map((value) => value.id).sort(),
    });
    return null;
  }
  const candidate = candidates[0]!;
  if (!equals(candidate, fact)) {
    const decision = findPlanningDecision(
      decisions,
      kind,
      fact.source,
      "CAPABILITY_DEFINITION_FACT_CONFLICT",
    );
    if (decision?.action === "select_existing") {
      entries.push(entry(fact, kind, "matched", "RECONCILED_SELECT_EXISTING", candidate.id));
      return { id: candidate.id, inserted: false };
    }
    if (decision?.action === "skip") {
      entries.push(entry(fact, kind, "skipped", "RECONCILED_SKIP", null));
      return null;
    }
    entries.push(
      entry(fact, kind, "conflicts", "CAPABILITY_DEFINITION_FACT_CONFLICT", candidate.id, true),
    );
    return null;
  }
  entries.push(entry(fact, kind, "matched", "CAPABILITY_DEFINITION_EXACT_MATCH", candidate.id));
  return { id: candidate.id, inserted: false };
}

function classifyAssignment<F extends DefinitionFact, V>(
  fact: F,
  desired: V,
  current: readonly V[],
  target: V[],
  equals: (left: V, right: V) => boolean,
  identityEquals: (left: V, right: V) => boolean,
  source: ImportSourceLocation,
  kind: ImportReportEntry["entityKind"],
  entries: ImportReportEntry[],
  decisions?: ImportPlanningDecisions,
): void {
  const candidates = [...current, ...target.filter((value) => identityEquals(value, desired))];
  if (candidates.length === 0) {
    target.push(desired);
    entries.push(
      entry(fact, kind, "inserted", "CAPABILITY_ASSIGNMENT_INSERT_PLANNED", null, false, source),
    );
  } else if (candidates.length === 1 && equals(candidates[0]!, desired))
    entries.push(
      entry(fact, kind, "matched", "CAPABILITY_ASSIGNMENT_EXACT_MATCH", null, false, source),
    );
  else {
    const decision = findPlanningDecision(
      decisions,
      kind,
      source,
      "CAPABILITY_ASSIGNMENT_FACT_CONFLICT",
    );
    if (decision?.action === "skip") {
      entries.push(entry(fact, kind, "skipped", "RECONCILED_SKIP", null, false, source));
      return;
    }
    entries.push(
      entry(fact, kind, "conflicts", "CAPABILITY_ASSIGNMENT_FACT_CONFLICT", null, true, source),
    );
  }
}

function dependencyEntry(
  fact: DefinitionFact,
  source: ImportSourceLocation,
  kind: ImportReportEntry["entityKind"],
  reasonCode: "CHARACTER_DEPENDENCY_MISSING" | "PREREQUISITE_DEPENDENCY_MISSING",
  decisions?: ImportPlanningDecisions,
): ImportReportEntry {
  const decision = findPlanningDecision(decisions, kind, source, reasonCode);
  return decision?.action === "skip"
    ? entry(fact, kind, "skipped", "RECONCILED_SKIP", null, false, source)
    : entry(fact, kind, "ambiguous", reasonCode, null, false, source);
}

export function materializeAbility(value: PlannedAbilityInsert): Ability {
  return {
    id: value.id,
    namePl: value.fact.namePl,
    normalizedNamePl: value.fact.normalizedNamePl,
    nameEn: null,
    type: value.fact.type,
    descriptionPl: null,
    verificationStatus: "UNKNOWN",
    notes: null,
  };
}
export function materializeSpell(value: PlannedSpellInsert): Spell {
  return {
    id: value.id,
    namePl: value.fact.namePl,
    normalizedNamePl: value.fact.normalizedNamePl,
    nameEn: null,
    level: value.fact.level,
    schoolPl: null,
    descriptionPl: null,
    verificationStatus: "UNKNOWN",
    notes: null,
  };
}
export function materializeIllithidPower(value: PlannedIllithidPowerInsert): IllithidPower {
  return {
    id: value.id,
    namePl: value.fact.namePl,
    normalizedNamePl: value.fact.normalizedNamePl,
    nameEn: null,
    tier: null,
    descriptionPl: null,
    verificationStatus: "UNKNOWN",
    notes: powerNotes(value.fact),
  };
}

function abilityEquals(value: Ability, fact: NormalizedLegacyAbility): boolean {
  return (
    value.namePl === fact.namePl &&
    value.normalizedNamePl === fact.normalizedNamePl &&
    value.nameEn === null &&
    value.type === fact.type &&
    value.descriptionPl === null &&
    value.verificationStatus === "UNKNOWN" &&
    value.notes === null
  );
}
function spellEquals(value: Spell, fact: NormalizedLegacySpell): boolean {
  return (
    value.namePl === fact.namePl &&
    value.normalizedNamePl === fact.normalizedNamePl &&
    value.nameEn === null &&
    value.level === fact.level &&
    value.schoolPl === null &&
    value.descriptionPl === null &&
    value.verificationStatus === "UNKNOWN" &&
    value.notes === null
  );
}
function powerEquals(value: IllithidPower, fact: NormalizedLegacyIllithidPower): boolean {
  return (
    value.namePl === fact.namePl &&
    value.normalizedNamePl === fact.normalizedNamePl &&
    value.nameEn === null &&
    value.tier === null &&
    value.descriptionPl === null &&
    value.verificationStatus === "UNKNOWN" &&
    value.notes === powerNotes(fact)
  );
}
function powerNotes(fact: NormalizedLegacyIllithidPower): string {
  return [
    `Status legacy: ${fact.legacyStatusPl}`,
    fact.pathRequirementPl === null ? null : `Ścieżka / wymóg: ${fact.pathRequirementPl}`,
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
}
function characterAbilityEquals(a: CharacterAbility, b: CharacterAbility): boolean {
  return (
    a.characterId === b.characterId &&
    a.abilityId === b.abilityId &&
    a.source === b.source &&
    a.levelAcquired === b.levelAcquired &&
    a.notes === b.notes
  );
}
function characterAbilityIdentityEquals(a: CharacterAbility, b: CharacterAbility): boolean {
  return a.characterId === b.characterId && a.abilityId === b.abilityId && a.source === b.source;
}
function characterSpellEquals(a: CharacterSpell, b: CharacterSpell): boolean {
  return (
    a.characterId === b.characterId &&
    a.spellId === b.spellId &&
    a.source === b.source &&
    a.known === b.known &&
    a.prepared === b.prepared &&
    a.alwaysPrepared === b.alwaysPrepared &&
    a.notes === b.notes
  );
}
function characterSpellIdentityEquals(a: CharacterSpell, b: CharacterSpell): boolean {
  return a.characterId === b.characterId && a.spellId === b.spellId && a.source === b.source;
}
function characterPowerEquals(a: CharacterIllithidPower, b: CharacterIllithidPower): boolean {
  return (
    a.characterId === b.characterId &&
    a.powerId === b.powerId &&
    a.acquiredAt?.toISOString() === b.acquiredAt?.toISOString() &&
    a.acquisitionSourcePl === b.acquisitionSourcePl &&
    a.notes === b.notes
  );
}
function characterPowerIdentityEquals(
  a: CharacterIllithidPower,
  b: CharacterIllithidPower,
): boolean {
  return a.characterId === b.characterId && a.powerId === b.powerId;
}
function prerequisiteEquals(a: IllithidPowerPrerequisite, b: IllithidPowerPrerequisite): boolean {
  return a.powerId === b.powerId && a.prerequisitePowerId === b.prerequisitePowerId;
}
function prerequisiteIdentityEquals(
  a: IllithidPowerPrerequisite,
  b: IllithidPowerPrerequisite,
): boolean {
  return a.powerId === b.powerId && a.prerequisitePowerId === b.prerequisitePowerId;
}
function entry(
  fact: DefinitionFact,
  entityKind: ImportReportEntry["entityKind"],
  category: ImportReportEntry["category"],
  reasonCode: string,
  canonicalEntityId: string | null,
  blocking = false,
  source: ImportSourceLocation = fact.source,
): ImportReportEntry {
  return {
    category,
    entityKind,
    source,
    sourceKey: fact.sourceKey,
    reasonCode,
    messagePl: messages[reasonCode] ?? "Fakt zdolności został sklasyfikowany.",
    blocking,
    canonicalEntityId,
    relatedIds: [],
  };
}
const messages: Readonly<Record<string, string>> = {
  CAPABILITY_DEFINITION_INSERT_PLANNED: "Definicja zostanie dodana.",
  CAPABILITY_DEFINITION_EXACT_MATCH: "Definicja jest już zgodna.",
  CAPABILITY_DEFINITION_AMBIGUOUS: "Definicja ma wielu kandydatów.",
  CAPABILITY_DEFINITION_FACT_CONFLICT: "Istniejąca definicja ma sprzeczne fakty.",
  CAPABILITY_ASSIGNMENT_INSERT_PLANNED: "Przypisanie zostanie dodane.",
  CAPABILITY_ASSIGNMENT_EXACT_MATCH: "Przypisanie jest już zgodne.",
  CAPABILITY_ASSIGNMENT_FACT_CONFLICT: "Istniejące przypisanie ma sprzeczne fakty.",
  CHARACTER_DEPENDENCY_MISSING: "Brakuje rozstrzygniętej postaci.",
  PREREQUISITE_DEPENDENCY_MISSING: "Brakuje rozstrzygniętej mocy wymaganej.",
  RECONCILED_SELECT_EXISTING: "Rekonsyliacja wskazała istniejący rekord.",
  RECONCILED_TREAT_AS_NEW: "Rekonsyliacja nakazała utworzyć nowy rekord.",
  RECONCILED_SKIP: "Rekonsyliacja pominęła fakt źródłowy.",
};
function sortEntries(values: readonly ImportReportEntry[]): readonly ImportReportEntry[] {
  return [...values].sort(
    (a, b) =>
      a.source.sheet.localeCompare(b.source.sheet, "pl-PL") ||
      a.source.row - b.source.row ||
      a.entityKind.localeCompare(b.entityKind, "pl-PL"),
  );
}
