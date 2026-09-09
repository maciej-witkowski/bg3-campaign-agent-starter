import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { CampaignReadToolPort } from "../../../src/application/tools/campaign-read-tools.js";
import { openM4CampaignApplication } from "../../../src/composition/m4-campaign-application.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import {
  READ_TOOL_CATALOG,
  assertValidReadToolCatalog,
  type ReadToolDefinition,
} from "../../../src/tools/catalog/read-tool-catalog.js";
import { createReadToolRegistry } from "../../../src/tools/registry/read-tool-registry.js";
import manifest from "../../../schemas/tools/tool-manifest.json" with { type: "json" };
import { seedM3CampaignFixture } from "../fixtures/m3-campaign-fixture.js";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "bg3-m4-read-tools-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "campaign.sqlite");
  const connection = openMigratedSqliteConnection({ filename });
  seedM3CampaignFixture(connection.database);
  const auditCount = connection.database.$client
    .prepare("select count(*) as count from change_events")
    .get() as { count: number };
  connection.close();
  return { filename, auditCount: auditCount.count };
}

function sha256(filename: string) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

describe("M4 read tool catalog and registry", () => {
  it("publishes exactly the 13 deterministic read/analysis capabilities and no future manifest entries", () => {
    const catalogNames = READ_TOOL_CATALOG.map((entry) => entry.name);
    expect(catalogNames).toEqual([...manifest.read, ...manifest.analysis]);
    expect(catalogNames).not.toContain("create_proposal");
    expect(catalogNames).not.toContain("equip_item");
    expect(catalogNames).not.toContain("resolve_item_identity");
    expect(new Set(catalogNames).size).toBe(13);
    expect(Object.isFrozen(READ_TOOL_CATALOG)).toBe(true);
    expect(READ_TOOL_CATALOG.every(Object.isFrozen)).toBe(true);
  });

  it("fails closed for duplicate definitions, unsupported categories, missing schemas and undeclared handlers", () => {
    expect(() =>
      assertValidReadToolCatalog([READ_TOOL_CATALOG[0]!, READ_TOOL_CATALOG[0]!]),
    ).toThrow("Duplicate");
    expect(() =>
      assertValidReadToolCatalog([
        { ...READ_TOOL_CATALOG[0]!, category: "mutation" } as unknown as ReadToolDefinition,
      ]),
    ).toThrow("Unsupported");
    expect(() =>
      assertValidReadToolCatalog([
        { ...READ_TOOL_CATALOG[0]!, inputSchema: undefined } as unknown as ReadToolDefinition,
      ]),
    ).toThrow("Missing schema");
    expect(() =>
      createReadToolRegistry({} as CampaignReadToolPort, [READ_TOOL_CATALOG[0]!]),
    ).toThrow("Undeclared read tool handler");
  });

  it("has no all-capability or mutation lookup surface and validates before its handler", async () => {
    let calls = 0;
    const port = new Proxy({} as CampaignReadToolPort, {
      get: () => () => {
        calls += 1;
        return {};
      },
    });
    const registry = createReadToolRegistry(port);
    expect(Object.keys(registry).sort()).toEqual(["get", "list", "run"]);
    expect(registry).not.toHaveProperty("invoke");
    expect(registry.get("equip_item")).toBeUndefined();
    await expect(registry.run("equip_item", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "TOOL_NOT_FOUND" },
    });
    await expect(registry.get("get_party")!.run({ injected: true })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT" },
    });
    expect(calls).toBe(0);
  });

  it("calls every active tool without an LLM and leaves SQLite bytes and audit rows unchanged", async () => {
    const { filename, auditCount } = fixture();
    const before = sha256(filename);
    const application = openM4CampaignApplication({ filename });
    try {
      expect(Object.keys(application).sort()).toEqual(["close", "readTools"]);
      const calls: Readonly<Record<string, unknown>> = {
        get_party: {},
        get_character: { character: "laezel" },
        get_character_build: { character: "laezel" },
        get_character_equipment: { character: "laezel" },
        find_inventory_items: { status: ["CHEST"], slot: "BODY", query: "Zbroja" },
        get_item: { item: "Pierścień Blasku" },
        get_character_spells: { character: "laezel", prepared: false },
        get_illithid_state: { character: "laezel" },
        get_recent_changes: { limit: 2 },
        compare_equipment: {
          character: "laezel",
          candidate_item: "inventory-armor",
          slot: "BODY",
          include_party_synergies: true,
        },
        calculate_effective_attributes: { character: "laezel" },
        find_equipment_candidates: { character: "laezel", slot: "RING_1", effect_types: ["BONUS"] },
        validate_campaign_state: {},
      };
      for (const definition of application.readTools.list()) {
        const result = await application.readTools
          .get(definition.name)!
          .run(calls[definition.name]);
        expect(() => JSON.stringify(result)).not.toThrow();
        expect(result.ok).toBe(true);
        if (result.ok) expect(definition.outputSchema.safeParse(result.data).success).toBe(true);
      }
      await expect(
        application.readTools.get("get_character")!.run({ character: "Nie istnieje" }),
      ).resolves.toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
      await expect(
        application.readTools.get("get_character")!.run({ character: "cien\u0301" }),
      ).resolves.toMatchObject({ ok: false, error: { code: "AMBIGUOUS" } });
      expect(
        await application.readTools
          .get("calculate_effective_attributes")!
          .run({ character: "laezel" }),
      ).toMatchObject({
        ok: true,
        data: {
          attributes: expect.arrayContaining([
            expect.objectContaining({ attribute: "STR", effective_value: 19 }),
          ]),
        },
      });
      expect(
        await application.readTools
          .get("find_equipment_candidates")!
          .run(calls.find_equipment_candidates),
      ).toMatchObject({
        ok: true,
        data: { items: [{ inventory_item: { id: "inventory-ring" } }] },
      });
      expect(await application.readTools.get("get_illithid_state")!.run({})).toMatchObject({
        ok: true,
        data: {
          character: null,
          powers: expect.arrayContaining([
            expect.objectContaining({ id: "power-tier-1", acquired: null }),
          ]),
        },
      });
      expect(
        await application.readTools.get("get_illithid_state")!.run({ character: "laezel" }),
      ).toMatchObject({
        ok: true,
        data: {
          powers: expect.arrayContaining([
            expect.objectContaining({ id: "power-tier-1", acquired: true }),
            expect.objectContaining({ id: "power-tier-2", acquired: false }),
          ]),
        },
      });
    } finally {
      application.close();
    }
    expect(sha256(filename)).toBe(before);
    const verification = openMigratedSqliteConnection({ filename });
    try {
      const after = verification.database.$client
        .prepare("select count(*) as count from change_events")
        .get() as { count: number };
      expect(after.count).toBe(auditCount);
    } finally {
      verification.close();
    }
  });

  it("never turns an unknown item slot into equipment compatibility", async () => {
    const { filename } = fixture();
    const application = openM4CampaignApplication({ filename });
    try {
      await expect(
        application.readTools.get("find_equipment_candidates")!.run({
          character: "laezel",
          slot: "RING_1",
        }),
      ).resolves.toMatchObject({
        ok: true,
        data: { items: [{ inventory_item: { id: "inventory-ring" } }] },
      });
      await expect(
        application.readTools.get("compare_equipment")!.run({
          character: "laezel",
          candidate_item: "inventory-story",
          include_party_synergies: false,
        }),
      ).resolves.toMatchObject({ ok: true, data: { currently_equipped: [] } });
      await expect(
        application.readTools.get("compare_equipment")!.run({
          character: "laezel",
          candidate_item: "inventory-story",
          slot: "RING_1",
          include_party_synergies: false,
        }),
      ).resolves.toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    } finally {
      application.close();
    }
  });

  it("rejects an explicit comparison slot incompatible with the candidate", async () => {
    const { filename } = fixture();
    const application = openM4CampaignApplication({ filename });
    try {
      await expect(
        application.readTools.get("compare_equipment")!.run({
          character: "laezel",
          candidate_item: "inventory-armor",
          slot: "RING_1",
          include_party_synergies: false,
        }),
      ).resolves.toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    } finally {
      application.close();
    }
  });

  it("preserves ability and spell verification status in read projections", async () => {
    const { filename } = fixture();
    const writable = openMigratedSqliteConnection({ filename });
    try {
      writable.database.$client.exec(
        "update abilities set verification_status = 'CONFLICT' where id = 'ability-gwm'",
      );
      writable.database.$client.exec(
        "update spells set verification_status = 'UNVERIFIED' where id = 'spell-jump'",
      );
    } finally {
      writable.close();
    }
    const application = openM4CampaignApplication({ filename });
    try {
      await expect(
        application.readTools.get("get_character_build")!.run({ character: "laezel" }),
      ).resolves.toMatchObject({
        ok: true,
        data: {
          abilities: expect.arrayContaining([
            expect.objectContaining({ id: "ability-gwm", verification_status: "CONFLICT" }),
          ]),
          spells: expect.arrayContaining([
            expect.objectContaining({ id: "spell-jump", verification_status: "UNVERIFIED" }),
          ]),
        },
      });
      await expect(
        application.readTools.get("get_character_spells")!.run({ character: "laezel" }),
      ).resolves.toMatchObject({
        ok: true,
        data: {
          spells: expect.arrayContaining([
            expect.objectContaining({ id: "spell-jump", verification_status: "UNVERIFIED" }),
          ]),
        },
      });
    } finally {
      application.close();
    }
  });

  it("does not recommend another character's protected story item", async () => {
    const { filename } = fixture();
    const writable = openMigratedSqliteConnection({ filename });
    try {
      writable.database.$client.exec(
        "update item_definitions set slot = 'RING' where id = 'definition-story'",
      );
    } finally {
      writable.close();
    }
    const application = openM4CampaignApplication({ filename });
    try {
      await expect(
        application.readTools.get("find_equipment_candidates")!.run({
          character: "laezel",
          slot: "RING_1",
        }),
      ).resolves.toMatchObject({
        ok: true,
        data: { items: [{ inventory_item: { id: "inventory-ring" } }] },
      });
    } finally {
      application.close();
    }
  });
});
