import { createHash } from "node:crypto";

import type {
  EquipmentSlot,
  InventoryStatus,
  ItemSlot,
  VerificationStatus,
} from "../../domain/model/campaign.js";
import type { ImportEntityKind, ImportSourceLocation } from "./import-contracts.js";
import type {
  LegacyNormalizationIssue,
  NormalizedLegacyCharacter,
} from "./legacy-character-normalizer.js";
import {
  createImportedItemFingerprint,
  mapLegacyEquipmentSlot,
  mapLegacyInventoryStatus,
  mapLegacyItemSlot,
  mapLegacyVerificationStatus,
  normalizePolishMatchingKey,
} from "./legacy-normalization.js";
import type {
  LegacyEquipmentRow,
  LegacyItemRow,
  LegacyStagedCell,
  LegacyTrackerStage,
} from "./legacy-tracker-stage.js";

export interface NormalizedLegacyItemEffect {
  readonly effectType: "LEGACY_TEXT";
  readonly descriptionPl: string;
  readonly verificationStatus: VerificationStatus;
}

export interface NormalizedLegacyInventoryPlacement {
  readonly status: InventoryStatus;
  readonly ownerCharacterCanonicalName: string | null;
  readonly obtainedLocationPl: string | null;
  readonly quantity: 1;
}

export interface NormalizedLegacyItem {
  readonly sourceKey: string;
  readonly source: ImportSourceLocation;
  readonly namePl: string;
  readonly normalizedNamePl: string;
  readonly nameEn: string | null;
  readonly unresolvedAliasEn: string | null;
  readonly typePl: string;
  readonly slot: ItemSlot | null;
  readonly rarityPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly verificationSource: string;
  readonly fingerprint: string;
  readonly tagsSynergyPl: string | null;
  readonly notes: string | null;
  readonly effect: NormalizedLegacyItemEffect | null;
  readonly placement: NormalizedLegacyInventoryPlacement;
  readonly equipmentSlot: EquipmentSlot | null;
}

export interface LegacyItemNormalizationResult {
  readonly items: readonly NormalizedLegacyItem[];
  readonly issues: readonly LegacyNormalizationIssue[];
}

interface EquipmentViewFact {
  readonly key: string;
  readonly source: ImportSourceLocation;
}

export function normalizeLegacyItems(
  stage: LegacyTrackerStage,
  characters: readonly NormalizedLegacyCharacter[],
): LegacyItemNormalizationResult {
  const issues: LegacyNormalizationIssue[] = [];
  const characterByDisplayName = new Map(characters.map((value) => [value.displayNamePl, value]));
  const equipmentFacts = normalizeEquipmentView(stage, characterByDisplayName, issues);
  const matchedEquipmentKeys = new Set<string>();
  const items: NormalizedLegacyItem[] = [];
  const byNormalizedName = new Map<string, NormalizedLegacyItem>();

  for (const row of stage.items) {
    const normalized = normalizeItemRow(stage, row, characterByDisplayName, issues);
    if (normalized === null) continue;
    const duplicateName = byNormalizedName.get(normalized.normalizedNamePl);
    if (duplicateName !== undefined) {
      if (sameImportedItem(duplicateName, normalized)) continue;
      issues.push(
        makeIssue(
          stage,
          row,
          "Nazwa PL",
          "item_definition",
          "ambiguous",
          "ITEM_NAME_COLLISION",
          true,
          {
            normalizedNamePl: normalized.normalizedNamePl,
            existingFingerprint: duplicateName.fingerprint,
            incomingFingerprint: normalized.fingerprint,
          },
        ),
      );
      continue;
    }

    if (normalized.equipmentSlot !== null) {
      const equipmentKey = placementKey(
        normalized.placement.ownerCharacterCanonicalName,
        normalized.namePl,
        normalized.equipmentSlot,
      );
      if (!equipmentFacts.has(equipmentKey)) {
        issues.push(
          makeIssue(
            stage,
            row,
            "Slot",
            "equipment_assignment",
            "conflicts",
            "EQUIPPED_ITEM_VIEW_MISMATCH",
            true,
            { equipmentKey },
          ),
        );
        continue;
      }
      matchedEquipmentKeys.add(equipmentKey);
    }
    byNormalizedName.set(normalized.normalizedNamePl, normalized);
    items.push(normalized);
  }

  for (const fact of equipmentFacts.values()) {
    if (matchedEquipmentKeys.has(fact.key)) continue;
    issues.push(
      makeIssueFromLocation(
        stage,
        fact.source,
        `equipment:${fact.key}`,
        "equipment_assignment",
        "conflicts",
        "EQUIPMENT_ROW_WITHOUT_ITEM",
        true,
        { equipmentKey: fact.key },
      ),
    );
  }
  return { items, issues: sortIssues(issues) };
}

function normalizeItemRow(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): NormalizedLegacyItem | null {
  const issueStart = issues.length;
  const namePl = requiredText(stage, row, "Nazwa PL", "item_definition", issues);
  const aliasEn = optionalText(stage, row, "Alias EN", "item_definition", issues);
  const typePl = requiredText(stage, row, "Kategoria", "item_definition", issues);
  const rarityPl = optionalText(stage, row, "Rzadkość", "item_definition", issues);
  const statusToken = requiredText(stage, row, "Status", "inventory_item", issues);
  const locationPl = requiredText(stage, row, "Lokalizacja / właściciel", "inventory_item", issues);
  const slotToken = optionalText(stage, row, "Slot", "item_definition", issues);
  const effectText = optionalText(stage, row, "Efekt / mechanika", "item_effect", issues);
  const verificationToken = requiredText(
    stage,
    row,
    "Weryfikacja efektu",
    "item_definition",
    issues,
  );
  const tagsSynergyPl = optionalText(stage, row, "Tagi synergii", "item_definition", issues);
  const notes = optionalText(stage, row, "Uwagi", "item_definition", issues);

  const status = statusToken === null ? null : mapLegacyInventoryStatus(statusToken);
  if (statusToken !== null && status === null)
    issues.push(
      makeIssue(stage, row, "Status", "inventory_item", "ambiguous", "ITEM_STATUS_UNKNOWN", false, {
        value: statusToken,
      }),
    );
  const verificationStatus =
    verificationToken === null ? null : mapLegacyVerificationStatus(verificationToken);
  if (verificationToken !== null && verificationStatus === null)
    issues.push(
      makeIssue(
        stage,
        row,
        "Weryfikacja efektu",
        "item_definition",
        "ambiguous",
        "VERIFICATION_STATUS_UNKNOWN",
        false,
        { value: verificationToken },
      ),
    );
  const slot = slotToken === null ? null : mapLegacyItemSlot(slotToken);
  const equipmentSlot = slotToken === null ? null : mapLegacyEquipmentSlot(slotToken);
  if (slotToken !== null && (slot === null || equipmentSlot === null))
    issues.push(
      makeIssue(stage, row, "Slot", "item_definition", "ambiguous", "ITEM_SLOT_UNKNOWN", false, {
        value: slotToken,
      }),
    );

  const ownerCharacterCanonicalName =
    status === null || locationPl === null
      ? null
      : resolveOwner(stage, row, status, locationPl, characters, issues);
  if (status === "EQUIPPED" && equipmentSlot === null)
    issues.push(
      makeIssue(
        stage,
        row,
        "Slot",
        "equipment_assignment",
        "conflicts",
        "EQUIPPED_ITEM_SLOT_MISSING",
        true,
        { slotToken },
      ),
    );
  if (aliasEn !== null)
    issues.push(
      makeIssue(
        stage,
        row,
        "Alias EN",
        "item_definition",
        "ambiguous",
        "ENGLISH_ALIAS_UNATTESTED",
        false,
        { aliasEn },
      ),
    );
  if (
    issues.slice(issueStart).some((entry) => entry.reasonCode !== "ENGLISH_ALIAS_UNATTESTED") ||
    namePl === null ||
    typePl === null ||
    status === null ||
    locationPl === null ||
    verificationToken === null ||
    verificationStatus === null
  ) {
    return null;
  }

  const fingerprint = createImportedItemFingerprint({
    namePl,
    typePl,
    slot,
    rarityPl,
    verificationStatus,
    effectDescriptionsPl: effectText === null ? [] : [effectText],
  });
  return {
    sourceKey: `item:${fingerprint}`,
    source: itemLocation(stage, row, null),
    namePl,
    normalizedNamePl: normalizePolishMatchingKey(namePl),
    nameEn: null,
    unresolvedAliasEn: aliasEn,
    typePl,
    slot,
    rarityPl,
    verificationStatus,
    verificationSource: verificationToken,
    fingerprint,
    tagsSynergyPl,
    notes,
    effect:
      effectText === null
        ? null
        : { effectType: "LEGACY_TEXT", descriptionPl: effectText, verificationStatus },
    placement: {
      status,
      ownerCharacterCanonicalName,
      obtainedLocationPl: status === "CHEST" ? "Skrzynia podróżna" : null,
      quantity: 1,
    },
    equipmentSlot: status === "EQUIPPED" ? equipmentSlot : null,
  };
}

function normalizeEquipmentView(
  stage: LegacyTrackerStage,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): ReadonlyMap<string, EquipmentViewFact> {
  const facts = new Map<string, EquipmentViewFact>();
  for (const row of stage.equipment) {
    const issueStart = issues.length;
    const displayName = equipmentRequiredText(stage, row, "Postać", issues);
    const itemName = equipmentRequiredText(stage, row, "Przedmiot PL", issues);
    const slotToken = equipmentRequiredText(stage, row, "Slot", issues);
    const statusToken = equipmentRequiredText(stage, row, "Status", issues);
    const character = displayName === null ? null : (characters.get(displayName) ?? null);
    if (displayName !== null && character === null)
      issues.push(
        makeEquipmentIssue(
          stage,
          row,
          "Postać",
          "ambiguous",
          "EQUIPMENT_CHARACTER_UNKNOWN",
          false,
          {
            value: displayName,
          },
        ),
      );
    const slot = slotToken === null ? null : mapLegacyEquipmentSlot(slotToken);
    if (slotToken !== null && slot === null)
      issues.push(
        makeEquipmentIssue(stage, row, "Slot", "ambiguous", "EQUIPMENT_SLOT_UNKNOWN", false, {
          value: slotToken,
        }),
      );
    if (statusToken !== null && mapLegacyInventoryStatus(statusToken) !== "EQUIPPED")
      issues.push(
        makeEquipmentIssue(stage, row, "Status", "conflicts", "EQUIPMENT_STATUS_INVALID", true, {
          value: statusToken,
        }),
      );
    if (issues.length !== issueStart || character === null || itemName === null || slot === null)
      continue;
    const key = placementKey(character.canonicalName, itemName, slot);
    if (facts.has(key)) {
      issues.push(
        makeEquipmentIssue(
          stage,
          row,
          "Przedmiot PL",
          "conflicts",
          "EQUIPMENT_ROW_DUPLICATE",
          true,
          {
            key,
          },
        ),
      );
      continue;
    }
    facts.set(key, { key, source: equipmentLocation(stage, row, null) });
  }
  return facts;
}

function resolveOwner(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  status: InventoryStatus,
  locationPl: string,
  characters: ReadonlyMap<string, NormalizedLegacyCharacter>,
  issues: LegacyNormalizationIssue[],
): string | null {
  if (status === "SOLD") return null;
  if (status === "CHEST" && locationPl === "Skrzynia podróżna") return null;
  const direct = characters.get(locationPl);
  if (direct !== undefined) return direct.canonicalName;
  const personalMatch = locationPl.match(/^(.+) — osobisty ekwipunek$/u);
  const personal = personalMatch?.[1] === undefined ? undefined : characters.get(personalMatch[1]);
  if (status === "PERSONAL_STORY" && personal !== undefined) return personal.canonicalName;
  issues.push(
    makeIssue(
      stage,
      row,
      "Lokalizacja / właściciel",
      "inventory_item",
      "ambiguous",
      "ITEM_OWNER_UNKNOWN",
      false,
      { status, locationPl },
    ),
  );
  return null;
}

function requiredText(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  field: keyof LegacyItemRow["cells"],
  entityKind: ImportEntityKind,
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = row.cells[field];
  if (cell.formula === null && typeof cell.value === "string" && cell.value.trim() !== "")
    return cell.value;
  issues.push(
    makeIssue(
      stage,
      row,
      field,
      entityKind,
      "conflicts",
      "REQUIRED_TEXT_INVALID",
      true,
      cellFacts(cell),
    ),
  );
  return null;
}

function optionalText(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  field: keyof LegacyItemRow["cells"],
  entityKind: ImportEntityKind,
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = row.cells[field];
  if (cell.formula === null && cell.value === null) return null;
  if (cell.formula === null && typeof cell.value === "string")
    return cell.value.trim() === "" ? null : cell.value;
  issues.push(
    makeIssue(
      stage,
      row,
      field,
      entityKind,
      "conflicts",
      "OPTIONAL_TEXT_INVALID",
      true,
      cellFacts(cell),
    ),
  );
  return null;
}

function equipmentRequiredText(
  stage: LegacyTrackerStage,
  row: LegacyEquipmentRow,
  field: keyof LegacyEquipmentRow["cells"],
  issues: LegacyNormalizationIssue[],
): string | null {
  const cell = row.cells[field];
  if (cell.formula === null && typeof cell.value === "string" && cell.value.trim() !== "")
    return cell.value;
  issues.push(
    makeEquipmentIssue(
      stage,
      row,
      field,
      "conflicts",
      "REQUIRED_TEXT_INVALID",
      true,
      cellFacts(cell),
    ),
  );
  return null;
}

type IssueFact = string | number | boolean | null;

function makeIssue(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  field: keyof LegacyItemRow["cells"],
  entityKind: ImportEntityKind,
  category: "ambiguous" | "conflicts",
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, IssueFact>>,
): LegacyNormalizationIssue {
  return makeIssueFromLocation(
    stage,
    itemLocation(stage, row, field),
    itemSourceKey(row),
    entityKind,
    category,
    reasonCode,
    blocking,
    rawFacts,
  );
}

function makeEquipmentIssue(
  stage: LegacyTrackerStage,
  row: LegacyEquipmentRow,
  field: keyof LegacyEquipmentRow["cells"],
  category: "ambiguous" | "conflicts",
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, IssueFact>>,
): LegacyNormalizationIssue {
  return makeIssueFromLocation(
    stage,
    equipmentLocation(stage, row, field),
    `equipment-row:${row.row}`,
    "equipment_assignment",
    category,
    reasonCode,
    blocking,
    rawFacts,
  );
}

function makeIssueFromLocation(
  stage: LegacyTrackerStage,
  source: ImportSourceLocation,
  sourceKey: string,
  entityKind: ImportEntityKind,
  category: "ambiguous" | "conflicts",
  reasonCode: string,
  blocking: boolean,
  rawFacts: Readonly<Record<string, IssueFact>>,
): LegacyNormalizationIssue {
  const issueId = `issue:${createHash("sha256")
    .update(
      `${stage.workbookSha256}|${source.sheet}|${source.row}|${source.field}|${reasonCode}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 24)}`;
  return {
    issueId,
    category,
    entityKind,
    source,
    sourceKey,
    reasonCode,
    messagePl: issueMessage(reasonCode),
    blocking,
    canonicalEntityId: null,
    relatedIds: [],
    rawFacts,
  };
}

function itemLocation(
  stage: LegacyTrackerStage,
  row: LegacyItemRow,
  field: keyof LegacyItemRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}

function equipmentLocation(
  stage: LegacyTrackerStage,
  row: LegacyEquipmentRow,
  field: keyof LegacyEquipmentRow["cells"] | null,
): ImportSourceLocation {
  return { profile: stage.profile, sheet: row.sheet, row: row.row, field };
}

function itemSourceKey(row: LegacyItemRow): string {
  const value = row.cells["Nazwa PL"].value;
  return typeof value === "string" && value.trim() !== ""
    ? `item-name:${normalizePolishMatchingKey(value)}`
    : `item-row:${row.row}`;
}

function placementKey(
  characterCanonicalName: string | null,
  itemNamePl: string,
  slot: EquipmentSlot,
): string {
  return `${characterCanonicalName ?? "<unknown>"}|${normalizePolishMatchingKey(itemNamePl)}|${slot}`;
}

function sameImportedItem(left: NormalizedLegacyItem, right: NormalizedLegacyItem): boolean {
  return (
    left.fingerprint === right.fingerprint &&
    left.placement.status === right.placement.status &&
    left.placement.ownerCharacterCanonicalName === right.placement.ownerCharacterCanonicalName &&
    left.placement.obtainedLocationPl === right.placement.obtainedLocationPl &&
    left.equipmentSlot === right.equipmentSlot &&
    left.notes === right.notes &&
    left.tagsSynergyPl === right.tagsSynergyPl
  );
}

function cellFacts(cell: LegacyStagedCell): Readonly<Record<string, IssueFact>> {
  return {
    value: cell.value instanceof Date ? cell.value.toISOString() : cell.value,
    formula: cell.formula,
  };
}

function issueMessage(reasonCode: string): string {
  const messages: Readonly<Record<string, string>> = {
    REQUIRED_TEXT_INVALID: "Wymagane pole tekstowe ma niepoprawny typ albo jest puste.",
    OPTIONAL_TEXT_INVALID: "Opcjonalne pole tekstowe ma niepoprawny typ.",
    ITEM_STATUS_UNKNOWN: "Nieznany status przedmiotu wymaga uzgodnienia.",
    VERIFICATION_STATUS_UNKNOWN: "Nieznany status weryfikacji wymaga uzgodnienia.",
    ITEM_SLOT_UNKNOWN: "Nieznana pozycja przedmiotu wymaga uzgodnienia.",
    ITEM_OWNER_UNKNOWN: "Nie można jednoznacznie wskazać właściciela przedmiotu.",
    ENGLISH_ALIAS_UNATTESTED: "Angielski alias wymaga jawnego potwierdzenia.",
    ITEM_NAME_COLLISION: "Ta sama znormalizowana nazwa wskazuje więcej niż jeden przedmiot.",
    EQUIPMENT_CHARACTER_UNKNOWN: "Nie można jednoznacznie wskazać postaci z widoku wyposażenia.",
    EQUIPMENT_SLOT_UNKNOWN: "Nieznana pozycja w widoku wyposażenia wymaga uzgodnienia.",
    EQUIPMENT_STATUS_INVALID: "Wiersz widoku wyposażenia nie ma statusu WYPOSAŻONY.",
    EQUIPMENT_ROW_DUPLICATE: "Widok wyposażenia zawiera powtórzone przypisanie.",
    EQUIPPED_ITEM_SLOT_MISSING: "Wyposażony przedmiot nie ma jednoznacznej pozycji wyposażenia.",
    EQUIPPED_ITEM_VIEW_MISMATCH:
      "Wyposażony przedmiot nie ma zgodnego wiersza w widoku wyposażenia.",
    EQUIPMENT_ROW_WITHOUT_ITEM: "Wiersz wyposażenia nie ma zgodnego przedmiotu w katalogu.",
  };
  return messages[reasonCode] ?? "Dane źródłowe wymagają uzgodnienia.";
}

function sortIssues(
  issues: readonly LegacyNormalizationIssue[],
): readonly LegacyNormalizationIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.source.sheet.localeCompare(right.source.sheet, "pl-PL") ||
      left.source.row - right.source.row ||
      (left.source.field ?? "").localeCompare(right.source.field ?? "", "pl-PL") ||
      left.reasonCode.localeCompare(right.reasonCode, "pl-PL"),
  );
}
