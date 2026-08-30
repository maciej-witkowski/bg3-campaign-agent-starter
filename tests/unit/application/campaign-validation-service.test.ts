import { describe, expect, it } from "vitest";

import {
  CampaignValidationService,
  type CampaignValidationReadPort,
} from "../../../src/application/inspection/campaign-validation-service.js";
import type { CampaignValidationStateReader } from "../../../src/domain/validation/campaign-validation.js";

function state(
  overrides: Partial<CampaignValidationStateReader> = {},
): CampaignValidationStateReader {
  return {
    listAllEquipment: () => [],
    listAllInventoryItems: () => [],
    listAllItemDefinitions: () => [],
    listAllPermanentModifiers: () => [],
    listAllCharacterSpells: () => [],
    ...overrides,
  };
}

function source(reader: CampaignValidationStateReader): CampaignValidationReadPort {
  return { read: (operation) => operation(reader) };
}

describe("CampaignValidationService", () => {
  it("returns a successful read-only report", () => {
    expect(new CampaignValidationService(source(state())).validate()).toEqual({
      valid: true,
      violations: [],
    });
  });

  it("returns deterministic violations without repairing state", () => {
    const inventory = {
      id: "inventory-1",
      itemDefinitionId: "definition-1",
      status: "CHEST" as const,
      ownerCharacterId: "character-1",
      quantity: 1,
      obtainedAt: null,
      obtainedLocation: null,
      notes: null,
    };
    const reader = state({ listAllInventoryItems: () => [inventory] });

    const result = new CampaignValidationService(source(reader)).validate();

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({ code: "INVENTORY_OWNER_INVALID" }),
    ]);
    expect(reader.listAllInventoryItems()).toEqual([inventory]);
  });

  it("runs the complete validator inside one read session", () => {
    let sessions = 0;
    const port: CampaignValidationReadPort = {
      read: (operation) => {
        sessions += 1;
        return operation(state());
      },
    };

    expect(new CampaignValidationService(port).validate()).toEqual({
      valid: true,
      violations: [],
    });
    expect(sessions).toBe(1);
  });
});
