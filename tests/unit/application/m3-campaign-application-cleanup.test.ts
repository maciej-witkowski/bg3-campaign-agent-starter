import { describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  close: vi.fn(() => {
    throw new Error("cleanup failure");
  }),
  setupError: new Error("schema failure"),
}));

vi.mock("../../../src/persistence/sqlite/read-only-connection.js", () => ({
  openReadOnlySqliteConnection: () => ({
    database: {},
    close: doubles.close,
  }),
}));

vi.mock("../../../src/persistence/sqlite/schema-compatibility.js", () => ({
  assertLatestCampaignSchema: () => {
    throw doubles.setupError;
  },
}));

import { openM3CampaignApplication } from "../../../src/composition/m3-campaign-application.js";

describe("openM3CampaignApplication setup cleanup", () => {
  it("preserves the setup failure when closing also fails", () => {
    expect(() => openM3CampaignApplication({ filename: "campaign.sqlite" })).toThrow(
      doubles.setupError,
    );
    expect(doubles.close).toHaveBeenCalledOnce();
  });
});
