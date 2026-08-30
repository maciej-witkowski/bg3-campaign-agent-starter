import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  calculateSnapshotSha256,
  deserializeCampaignSnapshot,
  normalizeCampaignSnapshot,
  serializeCampaignSnapshot,
  type CampaignSnapshotStateV1,
  type CampaignSnapshotV1,
} from "../../domain/snapshots/campaign-snapshot.js";

export const CAMPAIGN_EXPORT_FORMAT = "BG3_CAMPAIGN_EXPORT" as const;
export const CAMPAIGN_EXPORT_VERSION = 1 as const;

export interface CampaignExportV1 {
  readonly format: typeof CAMPAIGN_EXPORT_FORMAT;
  readonly version: typeof CAMPAIGN_EXPORT_VERSION;
  readonly sourceSnapshotFormat: typeof CAMPAIGN_SNAPSHOT_FORMAT;
  readonly sourceSnapshotVersion: typeof CAMPAIGN_SNAPSHOT_VERSION;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly stateSha256: string;
  readonly state: CampaignSnapshotStateV1;
}

export type CampaignExportErrorCode =
  | "MALFORMED_JSON"
  | "INVALID_STRUCTURE"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_VERSION"
  | "DIGEST_MISMATCH";

export class CampaignExportError extends Error {
  public override readonly name = "CampaignExportError";

  public constructor(
    public readonly code: CampaignExportErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function createCampaignExport(snapshotPayload: string): CampaignExportV1 {
  const snapshot = deserializeCampaignSnapshot(snapshotPayload);
  return fromSnapshot(snapshot);
}

export function normalizeCampaignExport(value: unknown): CampaignExportV1 {
  const root = object(value);
  const expectedKeys = [
    "format",
    "version",
    "sourceSnapshotFormat",
    "sourceSnapshotVersion",
    "schemaVersion",
    "exportedAt",
    "stateSha256",
    "state",
  ];
  if (
    Object.keys(root).length !== expectedKeys.length ||
    Object.keys(root).some((key) => !expectedKeys.includes(key))
  ) {
    invalid();
  }
  if (root.format !== CAMPAIGN_EXPORT_FORMAT)
    throw new CampaignExportError("UNSUPPORTED_FORMAT", "Nieobsługiwany format eksportu.");
  if (root.version !== CAMPAIGN_EXPORT_VERSION)
    throw new CampaignExportError("UNSUPPORTED_VERSION", "Nieobsługiwana wersja eksportu.");
  if (
    root.sourceSnapshotFormat !== CAMPAIGN_SNAPSHOT_FORMAT ||
    root.sourceSnapshotVersion !== CAMPAIGN_SNAPSHOT_VERSION
  ) {
    throw new CampaignExportError(
      "UNSUPPORTED_VERSION",
      "Eksport wskazuje nieobsługiwaną wersję snapshotu źródłowego.",
    );
  }
  if (typeof root.stateSha256 !== "string" || !/^[0-9a-f]{64}$/.test(root.stateSha256)) invalid();

  let snapshot: CampaignSnapshotV1;
  try {
    snapshot = normalizeCampaignSnapshot({
      format: root.sourceSnapshotFormat,
      version: root.sourceSnapshotVersion,
      schemaVersion: root.schemaVersion,
      capturedAt: root.exportedAt,
      state: root.state,
    });
  } catch {
    invalid();
  }
  const digest = stateDigest(snapshot.state);
  if (digest !== root.stateSha256)
    throw new CampaignExportError(
      "DIGEST_MISMATCH",
      "Suma kontrolna stanu eksportu jest niezgodna.",
    );
  return {
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    sourceSnapshotFormat: CAMPAIGN_SNAPSHOT_FORMAT,
    sourceSnapshotVersion: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: snapshot.schemaVersion,
    exportedAt: snapshot.capturedAt,
    stateSha256: digest,
    state: snapshot.state,
  };
}

export function serializeCampaignExport(value: unknown): string {
  return `${JSON.stringify(normalizeCampaignExport(value), null, 2)}\n`;
}

export function deserializeCampaignExport(payload: string): CampaignExportV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new CampaignExportError("MALFORMED_JSON", "Eksport nie jest poprawnym JSON.");
  }
  return normalizeCampaignExport(parsed);
}

export function exportAsSnapshot(value: CampaignExportV1): CampaignSnapshotV1 {
  const normalized = normalizeCampaignExport(value);
  return deserializeCampaignSnapshot(
    serializeCampaignSnapshot({
      format: normalized.sourceSnapshotFormat,
      version: normalized.sourceSnapshotVersion,
      schemaVersion: normalized.schemaVersion,
      capturedAt: normalized.exportedAt,
      state: normalized.state,
    }),
  );
}

function fromSnapshot(snapshot: CampaignSnapshotV1): CampaignExportV1 {
  return {
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    sourceSnapshotFormat: CAMPAIGN_SNAPSHOT_FORMAT,
    sourceSnapshotVersion: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: snapshot.schemaVersion,
    exportedAt: snapshot.capturedAt,
    stateSha256: stateDigest(snapshot.state),
    state: snapshot.state,
  };
}

function stateDigest(state: CampaignSnapshotStateV1): string {
  const payload = serializeCampaignSnapshot({
    format: CAMPAIGN_SNAPSHOT_FORMAT,
    version: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: 1,
    capturedAt: "1970-01-01T00:00:00.000Z",
    state,
  });
  return calculateSnapshotSha256(payload);
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function invalid(): never {
  throw new CampaignExportError("INVALID_STRUCTURE", "Niepoprawna struktura eksportu kampanii.");
}
