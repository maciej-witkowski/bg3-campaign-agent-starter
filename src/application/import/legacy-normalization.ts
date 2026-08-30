import { createHash } from "node:crypto";

import type {
  AbilityType,
  EquipmentSlot,
  InventoryStatus,
  ItemSlot,
  SpellSource,
  VerificationStatus,
} from "../../domain/model/campaign.js";

const LEGACY_INVENTORY_STATUSES = {
  WYPOSAŻONY: "EQUIPPED",
  SKRZYNIA: "CHEST",
  SYTUACYJNY: "SITUATIONAL",
  "FABULARNY / OSOBISTY": "PERSONAL_STORY",
  SPRZEDANY: "SOLD",
} as const satisfies Record<string, InventoryStatus>;

const LEGACY_EQUIPMENT_SLOTS = {
  Głowa: "HEAD",
  Płaszcz: "CLOAK",
  Odzienie: "BODY",
  Pancerz: "BODY",
  Rękawice: "HANDS",
  Buty: "FEET",
  Amulet: "NECK",
  "Pierścień 1": "RING_1",
  "Pierścień 2": "RING_2",
  Broń: "MAIN_HAND",
  Tarcza: "OFF_HAND",
  Dystans: "RANGED_MAIN_HAND",
} as const satisfies Record<string, EquipmentSlot>;

const LEGACY_ITEM_SLOTS = {
  Głowa: "HEAD",
  Płaszcz: "CLOAK",
  Odzienie: "BODY",
  Pancerz: "BODY",
  Rękawice: "HANDS",
  Buty: "FEET",
  Amulet: "NECK",
  "Pierścień 1": "RING",
  "Pierścień 2": "RING",
  Broń: "MAIN_HAND",
  Tarcza: "OFF_HAND",
  Dystans: "RANGED",
} as const satisfies Record<string, ItemSlot>;

const LEGACY_ABILITY_TYPES = {
  Sztuczka: "CANTRIP",
  Atut: "FEAT",
  "Mistyczna Inwokacja": "INVOCATION",
  Manewr: "MANEUVER",
  "Cecha klasowa": "CLASS_FEATURE",
  Pakt: "PACT",
} as const satisfies Record<string, AbilityType>;

const LEGACY_SPELL_SOURCES = {
  "Znany czar Czarownika": "CLASS",
  "Przygotowany czar Kleryka": "CLASS",
  "Księga Maga": "SPELLBOOK",
  "Pakt Księgi": "PACT",
  "Pancerz Cieni": "INVOCATION",
  "Przerażające Słowo": "INVOCATION",
} as const satisfies Record<string, SpellSource>;

const LEGACY_VERIFICATION_STATUSES = {
  "DO WERYFIKACJI": "UNVERIFIED",
  "CZĘŚCIOWO POTWIERDZONE": "UNVERIFIED",
  "POTWIERDZONE PRZEZ UŻYTKOWNIKA": "VERIFIED",
  "POTWIERDZONE W GRZE": "VERIFIED",
  "ZWERYFIKOWANE WCZEŚNIEJ": "VERIFIED",
} as const satisfies Record<string, VerificationStatus>;

export function normalizePolishMatchingKey(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL");
}

export function mapLegacyInventoryStatus(value: string): InventoryStatus | null {
  return lookup(LEGACY_INVENTORY_STATUSES, value);
}

export function mapLegacyEquipmentSlot(value: string): EquipmentSlot | null {
  return lookup(LEGACY_EQUIPMENT_SLOTS, value);
}

export function mapLegacyItemSlot(value: string): ItemSlot | null {
  return lookup(LEGACY_ITEM_SLOTS, value);
}

export function mapLegacyAbilityType(value: string): AbilityType | null {
  return lookup(LEGACY_ABILITY_TYPES, value);
}

export function mapLegacySpellSource(value: string): SpellSource | null {
  return lookup(LEGACY_SPELL_SOURCES, value);
}

export function mapLegacyVerificationStatus(value: string): VerificationStatus | null {
  return lookup(LEGACY_VERIFICATION_STATUSES, value);
}

export function mapLegacyYesNo(value: string): boolean | null {
  if (value === "TAK") return true;
  if (value === "NIE") return false;
  return null;
}

export function mapLegacyPrepared(value: string): boolean | null {
  if (value === "N/D") return false;
  return mapLegacyYesNo(value);
}

export interface ImportedItemFingerprintInput {
  readonly namePl: string;
  readonly typePl: string | null;
  readonly slot: ItemSlot | null;
  readonly rarityPl: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly effectDescriptionsPl: readonly string[];
}

export function createImportedItemFingerprint(input: ImportedItemFingerprintInput): string {
  const payload = JSON.stringify({
    namePl: input.namePl,
    typePl: input.typePl,
    slot: input.slot,
    rarityPl: input.rarityPl,
    verificationStatus: input.verificationStatus,
    effectDescriptionsPl: [...input.effectDescriptionsPl],
  });
  return `import-v1:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

function lookup<T>(values: Readonly<Record<string, T>>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(values, key) ? (values[key] ?? null) : null;
}
