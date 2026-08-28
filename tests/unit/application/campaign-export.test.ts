import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_EXPORT_FORMAT,
  CampaignExportError,
  createCampaignExport,
  deserializeCampaignExport,
  exportAsSnapshot,
  serializeCampaignExport,
} from "../../../src/application/export/campaign-export.js";
import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  SNAPSHOT_COLLECTIONS,
  serializeCampaignSnapshot,
} from "../../../src/domain/snapshots/campaign-snapshot.js";

const capturedAt = "2026-08-29T12:00:00.000Z";

function emptySnapshot(): string {
  return serializeCampaignSnapshot({
    format: CAMPAIGN_SNAPSHOT_FORMAT,
    version: CAMPAIGN_SNAPSHOT_VERSION,
    schemaVersion: 3,
    capturedAt,
    state: Object.fromEntries(SNAPSHOT_COLLECTIONS.map((name) => [name, []])),
  });
}

describe("campaign current-state export", () => {
  it("serializes deterministic JSON and converts back to a valid snapshot", () => {
    const value = createCampaignExport(emptySnapshot());
    const first = serializeCampaignExport(value);
    const second = serializeCampaignExport(deserializeCampaignExport(first));

    expect(first).toBe(second);
    expect(value.format).toBe(CAMPAIGN_EXPORT_FORMAT);
    expect(value.schemaVersion).toBe(3);
    expect(exportAsSnapshot(value).capturedAt).toBe(capturedAt);
  });

  it("rejects a modified state with a stale digest", () => {
    const value = createCampaignExport(emptySnapshot());
    const modified = JSON.stringify({
      ...value,
      state: { ...value.state, characters: [{ id: "injected" }] },
    });

    expect(() => deserializeCampaignExport(modified)).toThrowError(CampaignExportError);
  });
});
