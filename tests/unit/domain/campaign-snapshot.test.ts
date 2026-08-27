import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  SNAPSHOT_COLLECTIONS,
  calculateSnapshotSha256,
  deserializeCampaignSnapshot,
  serializeCampaignSnapshot,
  verifySnapshotSha256,
} from "../../../src/domain/snapshots/campaign-snapshot.js";
import type {
  SnapshotCollection,
  SnapshotRecord,
} from "../../../src/domain/snapshots/campaign-snapshot.js";

const capturedAt = "2026-08-26T12:00:00.000Z";

describe("CampaignSnapshotV1", () => {
  it("serializes byte-identically despite row and key insertion order", () => {
    const first = emptySnapshot();
    first.state.characters = [character("b"), character("a")];
    const second = emptySnapshot();
    second.state.characters = [
      Object.fromEntries(Object.entries(character("a")).reverse()),
      Object.fromEntries(Object.entries(character("b")).reverse()),
    ];

    const firstJson = serializeCampaignSnapshot(first);
    const secondJson = serializeCampaignSnapshot(second);
    expect(firstJson).toBe(secondJson);
    expect(calculateSnapshotSha256(firstJson)).toBe(calculateSnapshotSha256(secondJson));
  });

  it("round-trips Polish Unicode, nulls, booleans and signed numbers exactly", () => {
    const value = emptySnapshot();
    value.state.characters = [character("żółć")];
    value.state.permanentModifiers = [
      {
        id: "m",
        characterId: "żółć",
        targetType: "ATTRIBUTE",
        targetKey: "STR",
        modifier: -2,
        sourceNamePl: "Mikstura Łaski",
        sourceItemDefinitionId: null,
        provenanceType: "GAME_UI",
        permanent: true,
        active: false,
        notes: null,
        createdAt: capturedAt,
      },
    ];
    const json = serializeCampaignSnapshot(value);
    expect(deserializeCampaignSnapshot(json)).toEqual(JSON.parse(json));
  });

  it.each([
    ["MALFORMED_JSON", () => deserializeCampaignSnapshot("{")],
    ["UNSUPPORTED_VERSION", () => serializeCampaignSnapshot({ ...emptySnapshot(), version: 2 })],
    [
      "DUPLICATE_IDENTITY",
      () => {
        const v = emptySnapshot();
        v.state.characters = [character("a"), character("a")];
        return serializeCampaignSnapshot(v);
      },
    ],
    [
      "NON_FINITE_NUMBER",
      () => {
        const v = emptySnapshot();
        v.state.characterAttributes = [
          { characterId: "a", attribute: "STR", baseValue: Number.NaN },
        ];
        return serializeCampaignSnapshot(v);
      },
    ],
    [
      "INVALID_STRUCTURE",
      () => {
        const v = emptySnapshot();
        v.state.characterAbilities = [
          {
            characterId: "a",
            abilityId: "ability",
            source: "CLASS",
            levelAcquired: 1.5,
            notes: null,
          },
        ];
        return serializeCampaignSnapshot(v);
      },
    ],
    [
      "INVALID_STRUCTURE",
      () => {
        const v = emptySnapshot();
        v.state.illithidPowers = [
          {
            id: "power",
            namePl: "Moc",
            normalizedNamePl: "moc",
            nameEn: null,
            tier: 1.5,
            descriptionPl: null,
            verificationStatus: "UNKNOWN",
            notes: null,
          },
        ];
        return serializeCampaignSnapshot(v);
      },
    ],
    [
      "INVALID_STRUCTURE",
      () => serializeCampaignSnapshot({ ...emptySnapshot(), unexpected: true }),
    ],
  ])("rejects %s", (code, operation) => {
    expect(operation).toThrowError(expect.objectContaining({ code }));
  });

  it.each([
    ["offset timestamp", "2026-08-26T12:00:00.000+00:00"],
    ["missing milliseconds", "2026-08-26T12:00:00Z"],
    ["invalid calendar date", "2026-02-30T12:00:00.000Z"],
  ])("rejects non-canonical capturedAt: %s", (_case, value) => {
    const snapshot = emptySnapshot();
    snapshot.capturedAt = value;
    expect(() => serializeCampaignSnapshot(snapshot)).toThrowError(
      expect.objectContaining({ code: "INVALID_STRUCTURE" }),
    );
  });

  it("rejects digest mismatch after validating payload", () => {
    const json = serializeCampaignSnapshot(emptySnapshot());
    expect(() => verifySnapshotSha256(json, "0".repeat(64))).toThrowError(
      expect.objectContaining({ code: "DIGEST_MISMATCH" }),
    );
    expect(verifySnapshotSha256(json, calculateSnapshotSha256(json))).toEqual(
      deserializeCampaignSnapshot(json),
    );
  });
});

type MutableSnapshotInput = {
  format: typeof CAMPAIGN_SNAPSHOT_FORMAT;
  version: typeof CAMPAIGN_SNAPSHOT_VERSION;
  schemaVersion: number;
  capturedAt: string;
  state: Record<SnapshotCollection, SnapshotRecord[]>;
};

function emptySnapshot(): MutableSnapshotInput {
  return {
    format: CAMPAIGN_SNAPSHOT_FORMAT,
    version: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: 3,
    capturedAt,
    state: emptySnapshotState(),
  };
}
function emptySnapshotState(): Record<SnapshotCollection, SnapshotRecord[]> {
  const state = {} as Record<SnapshotCollection, SnapshotRecord[]>;
  for (const collection of SNAPSHOT_COLLECTIONS) state[collection] = [];
  return state;
}
function character(id: string) {
  return {
    id,
    canonicalName: id,
    displayNamePl: "Żółć",
    racePl: null,
    classPl: "Łotrzyk",
    subclassPl: null,
    level: 1,
    roleSummary: "Wsparcie",
    activeParty: true,
    notes: null,
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };
}
