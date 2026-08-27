import { createHash } from "node:crypto";
export const CAMPAIGN_SNAPSHOT_FORMAT = "BG3_CAMPAIGN_SNAPSHOT" as const;
export const LEGACY_CHECKPOINT_FORMAT = "BG3_LEGACY_CHECKPOINT" as const;
export const CAMPAIGN_SNAPSHOT_VERSION = 1 as const;
export const SNAPSHOT_COLLECTIONS = [
  "characters",
  "characterAttributes",
  "permanentModifiers",
  "itemDefinitions",
  "itemEffects",
  "inventoryItems",
  "equipment",
  "spells",
  "characterSpells",
  "abilities",
  "characterAbilities",
  "illithidPowers",
  "illithidPowerPrerequisites",
  "characterIllithidPowers",
] as const;
export type SnapshotCollection = (typeof SNAPSHOT_COLLECTIONS)[number];
export type SnapshotScalar = string | number | boolean | null;
export type SnapshotRecord = Readonly<Record<string, SnapshotScalar>>;
export type CampaignSnapshotStateV1 = Readonly<
  Record<SnapshotCollection, readonly SnapshotRecord[]>
>;
export interface CampaignSnapshotV1 {
  readonly format: typeof CAMPAIGN_SNAPSHOT_FORMAT;
  readonly version: typeof CAMPAIGN_SNAPSHOT_VERSION;
  readonly schemaVersion: number;
  readonly capturedAt: string;
  readonly state: CampaignSnapshotStateV1;
}
export type CampaignSnapshotErrorCode =
  | "MALFORMED_JSON"
  | "INVALID_STRUCTURE"
  | "METADATA_MISMATCH"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_VERSION"
  | "DUPLICATE_IDENTITY"
  | "NON_FINITE_NUMBER"
  | "DIGEST_MISMATCH";
export class CampaignSnapshotError extends Error {
  public override readonly name = "CampaignSnapshotError";
  public constructor(
    public readonly code: CampaignSnapshotErrorCode,
    message: string,
  ) {
    super(message);
  }
}
type FieldKind =
  | "string"
  | "nullableString"
  | "boolean"
  | "integer"
  | "nullableInteger"
  | "number"
  | "nullableNumber";
interface CollectionSpec {
  readonly fields: Readonly<Record<string, FieldKind>>;
  readonly identity: readonly string[];
}
const specs: Readonly<Record<SnapshotCollection, CollectionSpec>> = {
  characters: {
    fields: {
      id: "string",
      canonicalName: "string",
      displayNamePl: "string",
      racePl: "nullableString",
      classPl: "string",
      subclassPl: "nullableString",
      level: "integer",
      roleSummary: "string",
      activeParty: "boolean",
      notes: "nullableString",
      createdAt: "string",
      updatedAt: "string",
    },
    identity: ["id"],
  },
  characterAttributes: {
    fields: { characterId: "string", attribute: "string", baseValue: "integer" },
    identity: ["characterId", "attribute"],
  },
  permanentModifiers: {
    fields: {
      id: "string",
      characterId: "string",
      targetType: "string",
      targetKey: "string",
      modifier: "integer",
      sourceNamePl: "string",
      sourceItemDefinitionId: "nullableString",
      provenanceType: "string",
      permanent: "boolean",
      active: "boolean",
      notes: "nullableString",
      createdAt: "string",
    },
    identity: ["id"],
  },
  itemDefinitions: {
    fields: {
      id: "string",
      namePl: "string",
      normalizedNamePl: "string",
      nameEn: "nullableString",
      typePl: "nullableString",
      slot: "nullableString",
      rarityPl: "nullableString",
      descriptionPl: "nullableString",
      verificationStatus: "string",
      verificationConfidence: "nullableNumber",
      verificationSource: "nullableString",
      fingerprint: "nullableString",
      notes: "nullableString",
    },
    identity: ["id"],
  },
  itemEffects: {
    fields: {
      id: "string",
      itemDefinitionId: "string",
      effectType: "string",
      numericValue: "nullableNumber",
      diceExpression: "nullableString",
      damageType: "nullableString",
      trigger: "nullableString",
      conditionTextPl: "nullableString",
      durationTextPl: "nullableString",
      descriptionPl: "string",
      verificationStatus: "string",
    },
    identity: ["id"],
  },
  inventoryItems: {
    fields: {
      id: "string",
      itemDefinitionId: "string",
      status: "string",
      ownerCharacterId: "nullableString",
      quantity: "integer",
      obtainedAt: "nullableString",
      obtainedLocation: "nullableString",
      notes: "nullableString",
    },
    identity: ["id"],
  },
  equipment: {
    fields: { inventoryItemId: "string", characterId: "string", slot: "string" },
    identity: ["inventoryItemId"],
  },
  spells: {
    fields: {
      id: "string",
      namePl: "string",
      normalizedNamePl: "string",
      nameEn: "nullableString",
      level: "integer",
      schoolPl: "nullableString",
      descriptionPl: "nullableString",
      verificationStatus: "string",
      notes: "nullableString",
    },
    identity: ["id"],
  },
  characterSpells: {
    fields: {
      characterId: "string",
      spellId: "string",
      source: "string",
      known: "boolean",
      prepared: "boolean",
      alwaysPrepared: "boolean",
      notes: "nullableString",
    },
    identity: ["characterId", "spellId", "source"],
  },
  abilities: {
    fields: {
      id: "string",
      namePl: "string",
      normalizedNamePl: "string",
      nameEn: "nullableString",
      type: "string",
      descriptionPl: "nullableString",
      verificationStatus: "string",
      notes: "nullableString",
    },
    identity: ["id"],
  },
  characterAbilities: {
    fields: {
      characterId: "string",
      abilityId: "string",
      source: "string",
      levelAcquired: "nullableInteger",
      notes: "nullableString",
    },
    identity: ["characterId", "abilityId", "source"],
  },
  illithidPowers: {
    fields: {
      id: "string",
      namePl: "string",
      normalizedNamePl: "string",
      nameEn: "nullableString",
      tier: "nullableInteger",
      descriptionPl: "nullableString",
      verificationStatus: "string",
      notes: "nullableString",
    },
    identity: ["id"],
  },
  illithidPowerPrerequisites: {
    fields: { powerId: "string", prerequisitePowerId: "string" },
    identity: ["powerId", "prerequisitePowerId"],
  },
  characterIllithidPowers: {
    fields: {
      characterId: "string",
      powerId: "string",
      acquiredAt: "nullableString",
      acquisitionSourcePl: "nullableString",
      notes: "nullableString",
    },
    identity: ["characterId", "powerId"],
  },
};
export function normalizeCampaignSnapshot(value: unknown): CampaignSnapshotV1 {
  const root = object(value, "snapshot");
  exactKeys(root, ["format", "version", "schemaVersion", "capturedAt", "state"], "snapshot");
  if (root.format !== CAMPAIGN_SNAPSHOT_FORMAT || root.version !== CAMPAIGN_SNAPSHOT_VERSION)
    throw new CampaignSnapshotError(
      "UNSUPPORTED_VERSION",
      "Nieobsługiwany format lub wersja snapshotu.",
    );
  if (!Number.isInteger(root.schemaVersion) || (root.schemaVersion as number) < 1)
    invalid("schemaVersion");
  if (!isCanonicalUtcInstant(root.capturedAt)) invalid("capturedAt");
  const inputState = object(root.state, "state");
  exactKeys(inputState, SNAPSHOT_COLLECTIONS, "state");
  const state = {} as Record<SnapshotCollection, readonly SnapshotRecord[]>;
  for (const collection of SNAPSHOT_COLLECTIONS) {
    const rows = inputState[collection];
    if (!Array.isArray(rows)) invalid(collection);
    const seen = new Set<string>();
    const normalized = rows.map((row, index) => normalizeRow(collection, row, index));
    for (const row of normalized) {
      const identity = JSON.stringify(specs[collection].identity.map((key) => row[key]));
      if (seen.has(identity))
        throw new CampaignSnapshotError(
          "DUPLICATE_IDENTITY",
          `Duplikat w ${collection}: ${identity}`,
        );
      seen.add(identity);
    }
    state[collection] = normalized.sort((left, right) => compareIdentity(collection, left, right));
  }
  return {
    format: CAMPAIGN_SNAPSHOT_FORMAT,
    version: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: root.schemaVersion as number,
    capturedAt: root.capturedAt,
    state,
  };
}
export function serializeCampaignSnapshot(value: unknown): string {
  return JSON.stringify(normalizeCampaignSnapshot(value));
}
export function deserializeCampaignSnapshot(payload: string): CampaignSnapshotV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new CampaignSnapshotError("MALFORMED_JSON", "Snapshot nie jest poprawnym JSON.");
  }
  return normalizeCampaignSnapshot(parsed);
}
export function calculateSnapshotSha256(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
export function verifySnapshotSha256(payload: string, expectedDigest: string): CampaignSnapshotV1 {
  const snapshot = deserializeCampaignSnapshot(payload);
  if (calculateSnapshotSha256(payload) !== expectedDigest)
    throw new CampaignSnapshotError("DIGEST_MISMATCH", "Suma kontrolna snapshotu jest niezgodna.");
  return snapshot;
}
export interface StoredCheckpointSnapshot {
  readonly snapshotFormat: string;
  readonly snapshotVersion: number;
  readonly schemaVersion: number;
  readonly snapshotJson: string;
  readonly snapshotSha256: string;
}
export function verifyCheckpointSnapshot(value: StoredCheckpointSnapshot): CampaignSnapshotV1 {
  if (value.snapshotFormat !== CAMPAIGN_SNAPSHOT_FORMAT)
    throw new CampaignSnapshotError(
      "UNSUPPORTED_FORMAT",
      `Nieobsługiwany format checkpointu: ${value.snapshotFormat}.`,
    );
  if (value.snapshotVersion !== CAMPAIGN_SNAPSHOT_VERSION)
    throw new CampaignSnapshotError(
      "UNSUPPORTED_VERSION",
      `Nieobsługiwana wersja checkpointu: ${value.snapshotVersion}.`,
    );
  const snapshot = verifySnapshotSha256(value.snapshotJson, value.snapshotSha256);
  if (value.schemaVersion !== snapshot.schemaVersion)
    throw new CampaignSnapshotError(
      "METADATA_MISMATCH",
      "Wersja schematu checkpointu nie zgadza się z payloadem.",
    );
  return snapshot;
}

function isCanonicalUtcInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
function normalizeRow(
  collection: SnapshotCollection,
  value: unknown,
  index: number,
): SnapshotRecord {
  const row = object(value, `${collection}[${index}]`);
  const fields = specs[collection].fields;
  exactKeys(row, Object.keys(fields), `${collection}[${index}]`);
  const normalized: Record<string, SnapshotScalar> = {};
  for (const [field, kind] of Object.entries(fields)) {
    const scalar = row[field];
    if (!matches(kind, scalar)) {
      if (typeof scalar === "number" && !Number.isFinite(scalar))
        throw new CampaignSnapshotError("NON_FINITE_NUMBER", `${collection}.${field}`);
      invalid(`${collection}.${field}`);
    }
    normalized[field] = scalar as SnapshotScalar;
  }
  return normalized;
}
function matches(kind: FieldKind, value: unknown): boolean {
  if (kind === "string") return typeof value === "string";
  if (kind === "nullableString") return value === null || typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "integer")
    return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
  if (kind === "nullableInteger")
    return (
      value === null ||
      (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value))
    );
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
function compareIdentity(
  collection: SnapshotCollection,
  left: SnapshotRecord,
  right: SnapshotRecord,
): number {
  for (const key of specs[collection].identity) {
    const comparison = String(left[key]).localeCompare(String(right[key]), "en");
    if (comparison !== 0) return comparison;
  }
  return 0;
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key)))
    invalid(path);
}
function invalid(path: string): never {
  throw new CampaignSnapshotError("INVALID_STRUCTURE", `Niepoprawna struktura snapshotu: ${path}.`);
}
