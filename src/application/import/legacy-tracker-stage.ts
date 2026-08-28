export const LEGACY_TRACKER_PROFILE = "BG3_TRACKER_LEGACY_V0" as const;

export const LEGACY_TRACKER_SHEETS = [
  "Dashboard",
  "Postacie",
  "Wyposażenie",
  "Przedmioty",
  "Zdolności",
  "Czary",
  "Moce illithidów",
  "Dziennik zmian",
  "Zasady pracy",
  "Prompt dla agenta",
] as const;

export const LEGACY_CHARACTER_HEADERS = [
  "ID",
  "Postać",
  "Aktywna",
  "Poziom",
  "Rasa",
  "Klasa",
  "Podklasa",
  "Pakt / wariant",
  "Rola",
  "SIŁ bazowa",
  "Stała premia SIŁ",
  "SIŁ aktualna",
  "ZR",
  "KON",
  "INT",
  "MĄD",
  "CHA",
  "Uwagi",
] as const;
export const LEGACY_EQUIPMENT_HEADERS = [
  "Postać",
  "Slot",
  "Przedmiot PL",
  "Status",
  "Uwagi",
] as const;
export const LEGACY_ITEM_HEADERS = [
  "Nazwa PL",
  "Alias EN",
  "Kategoria",
  "Rzadkość",
  "Status",
  "Lokalizacja / właściciel",
  "Slot",
  "Efekt / mechanika",
  "Weryfikacja efektu",
  "Tagi synergii",
  "Uwagi",
] as const;
export const LEGACY_ABILITY_HEADERS = [
  "Postać",
  "Typ",
  "Nazwa",
  "Poziom wyboru",
  "Status",
  "Uwagi",
] as const;
export const LEGACY_SPELL_HEADERS = [
  "Postać",
  "Czar",
  "Poziom czaru",
  "Źródło",
  "Znany / dostępny",
  "Przygotowany",
  "Uwagi",
] as const;
export const LEGACY_ILLITHID_HEADERS = [
  "Postać",
  "Moc",
  "Status",
  "Ścieżka / wymóg",
  "Uwagi",
] as const;
export const LEGACY_CHANGE_LOG_HEADERS = [
  "Data",
  "Postać",
  "Obszar",
  "Przed",
  "Po",
  "Powód",
  "Status",
] as const;

export type LegacyScalar = string | number | boolean | Date | null;

export interface LegacyStagedCell {
  readonly value: LegacyScalar;
  readonly formula: string | null;
  readonly column: number;
}

export interface LegacyStagedRow<Field extends string> {
  readonly sheet: string;
  readonly row: number;
  readonly cells: Readonly<Record<Field, LegacyStagedCell>>;
}

export type LegacyCharacterRow = LegacyStagedRow<(typeof LEGACY_CHARACTER_HEADERS)[number]>;
export type LegacyEquipmentRow = LegacyStagedRow<(typeof LEGACY_EQUIPMENT_HEADERS)[number]>;
export type LegacyItemRow = LegacyStagedRow<(typeof LEGACY_ITEM_HEADERS)[number]>;
export type LegacyAbilityRow = LegacyStagedRow<(typeof LEGACY_ABILITY_HEADERS)[number]>;
export type LegacySpellRow = LegacyStagedRow<(typeof LEGACY_SPELL_HEADERS)[number]>;
export type LegacyIllithidRow = LegacyStagedRow<(typeof LEGACY_ILLITHID_HEADERS)[number]>;
export type LegacyChangeLogRow = LegacyStagedRow<(typeof LEGACY_CHANGE_LOG_HEADERS)[number]>;

export interface LegacyTrackerStage {
  readonly profile: typeof LEGACY_TRACKER_PROFILE;
  readonly workbookSha256: string;
  readonly characters: readonly LegacyCharacterRow[];
  readonly equipment: readonly LegacyEquipmentRow[];
  readonly items: readonly LegacyItemRow[];
  readonly abilities: readonly LegacyAbilityRow[];
  readonly spells: readonly LegacySpellRow[];
  readonly illithidPowers: readonly LegacyIllithidRow[];
  readonly legacyChangeLog: readonly LegacyChangeLogRow[];
}
