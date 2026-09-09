import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { openM4CampaignApplication } from "../../../src/composition/m4-campaign-application.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import {
  canonicalJsonDigest,
  type MutationAuthorizationClaim,
  type MutationAuthorizationDecision,
  type MutationAuthorizationPort,
  type MutationAuthorizationRequest,
} from "../../../src/tools/authorization/mutation-authorization.js";
import {
  MUTATION_TOOL_CATALOG,
  MUTATION_TOOL_NAMES,
  assertValidMutationToolCatalog,
  type MutationToolDefinition,
  type MutationToolName,
} from "../../../src/tools/catalog/mutation-tool-catalog.js";
import {
  PROPOSAL_TOOL_CATALOG,
  assertValidProposalToolCatalog,
  type ProposalToolDefinition,
} from "../../../src/tools/catalog/proposal-tool-catalog.js";
import {
  mutationReceiptSchema,
  type JsonValue,
  type MutationReceipt,
} from "../../../src/tools/contracts/domain-contracts.js";
import {
  createMutationToolRegistry,
  type MutationToolHandlers,
} from "../../../src/tools/registry/mutation-tool-registry.js";
import { createProposalToolRegistry } from "../../../src/tools/registry/proposal-tool-registry.js";
import manifest from "../../../schemas/tools/tool-manifest.json" with { type: "json" };
import { seedM3CampaignFixture } from "../fixtures/m3-campaign-fixture.js";

interface FakeAuthorizationContext {
  readonly authorizationId: string;
  readonly expectedTool: string;
  readonly expectedDigest: string;
  readonly expectedClaim: MutationAuthorizationClaim;
  readonly expiresAt: number;
  used: boolean;
  readonly ambiguous?: boolean;
}

const NOW = Date.parse("2026-09-01T12:00:00.000Z");
const receipt: MutationReceipt = {
  changed: true,
  change_event_id: "change-1",
  occurred_at: "2026-09-01T12:00:00.000Z",
};
const proposalInput = {
  item: "Pierścień Blasku",
  confirmation: { proposal_id: "proposal-1" },
} as const;
const directFactInput = {
  item: "Pierścień Blasku",
  confirmation: {
    direct_fact: true,
    source_utterance: "Sprzedałem Pierścień Blasku.",
  },
} as const;

function claimsEqual(left: MutationAuthorizationClaim, right: MutationAuthorizationClaim): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

class FakeAuthorizer implements MutationAuthorizationPort<FakeAuthorizationContext> {
  public authorize(
    context: FakeAuthorizationContext,
    request: MutationAuthorizationRequest,
  ): MutationAuthorizationDecision {
    if (context.ambiguous)
      return { authorized: false, code: "CONFIRMATION_REQUIRED", reason: "AMBIGUOUS" };
    if (context.expiresAt <= NOW)
      return { authorized: false, code: "CONFIRMATION_INVALID", reason: "EXPIRED" };
    if (context.used)
      return { authorized: false, code: "CONFIRMATION_INVALID", reason: "REPLAYED" };
    if (context.expectedTool !== request.toolName)
      return { authorized: false, code: "CONFIRMATION_INVALID", reason: "TOOL_MISMATCH" };
    if (context.expectedDigest !== request.payloadDigest)
      return { authorized: false, code: "CONFIRMATION_INVALID", reason: "PAYLOAD_MISMATCH" };
    if (!claimsEqual(context.expectedClaim, request.claim))
      return { authorized: false, code: "CONFIRMATION_INVALID", reason: "CLAIM_MISMATCH" };
    context.used = true;
    return { authorized: true, authorizationId: context.authorizationId };
  }
}

function contextFor(
  toolName: string,
  input: JsonValue,
  claim: MutationAuthorizationClaim,
): FakeAuthorizationContext {
  return {
    authorizationId: "authorization-1",
    expectedTool: toolName,
    expectedDigest: canonicalJsonDigest(input),
    expectedClaim: claim,
    expiresAt: NOW + 60_000,
    used: false,
  };
}

function handlers(spy = vi.fn(() => receipt)): MutationToolHandlers {
  return Object.fromEntries(
    MUTATION_TOOL_NAMES.map((name) => [name, spy]),
  ) as unknown as MutationToolHandlers;
}

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("M4 proposal and mutation capability registries", () => {
  it("publishes separate create_proposal and exactly ten mutation contracts", () => {
    expect(PROPOSAL_TOOL_CATALOG.map(({ name }) => name)).toEqual(manifest.proposal);
    expect(MUTATION_TOOL_CATALOG.map(({ name }) => name)).toEqual(manifest.mutation);
    expect(new Set(MUTATION_TOOL_NAMES).size).toBe(10);
    expect(
      MUTATION_TOOL_CATALOG.every(({ outputSchema }) => outputSchema.safeParse(receipt).success),
    ).toBe(true);
    expect(MUTATION_TOOL_CATALOG.every(Object.isFrozen)).toBe(true);
  });

  it("fails closed for duplicate or cross-capability catalog definitions", () => {
    expect(() =>
      assertValidProposalToolCatalog([PROPOSAL_TOOL_CATALOG[0]!, PROPOSAL_TOOL_CATALOG[0]!]),
    ).toThrow("Duplicate");
    expect(() =>
      assertValidProposalToolCatalog([
        { ...PROPOSAL_TOOL_CATALOG[0]!, category: "mutation" } as unknown as ProposalToolDefinition,
      ]),
    ).toThrow("Unsupported");
    expect(() =>
      assertValidMutationToolCatalog([MUTATION_TOOL_CATALOG[0]!, MUTATION_TOOL_CATALOG[0]!]),
    ).toThrow("Duplicate");
    expect(() =>
      assertValidMutationToolCatalog([
        { ...MUTATION_TOOL_CATALOG[0]!, category: "proposal" } as unknown as MutationToolDefinition,
      ]),
    ).toThrow("Unsupported");
  });

  it("uses the strict CampaignMutationResult-compatible receipt union", () => {
    expect(mutationReceiptSchema.safeParse({ changed: false }).success).toBe(true);
    expect(mutationReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(
      mutationReceiptSchema.safeParse({ changed: false, change_event_id: "invented" }).success,
    ).toBe(false);
    expect(
      mutationReceiptSchema.safeParse({
        changed: true,
        change_event_id: "change-1",
        occurred_at: "2026-09-01T14:00:00.000+02:00",
      }).success,
    ).toBe(false);
  });

  it("constructs an ephemeral proposal only through its injected handler", async () => {
    const handler = vi.fn(() => ({
      id: "proposal-1",
      intent_type: "SELL_ITEM",
      human_summary_pl: "Sprzedaj Pierścień Blasku.",
      payload: { item: "Pierścień Blasku" },
      status: "OPEN" as const,
      created_at: "2026-09-01T12:00:00.000Z",
      expires_at: "2026-09-01T12:05:00.000Z",
    }));
    const registry = createProposalToolRegistry(handler);

    expect(Object.keys(registry).sort()).toEqual(["list", "run"]);
    expect(registry).not.toHaveProperty("invoke");
    await expect(
      registry.run("create_proposal", {
        intent_type: "SELL_ITEM",
        human_summary_pl: "Sprzedaj Pierścień Blasku.",
        payload: { item: "Pierścień Blasku" },
      }),
    ).resolves.toMatchObject({ ok: true, data: { id: "proposal-1", status: "OPEN" } });
    expect(handler).toHaveBeenCalledOnce();
    await expect(registry.run("confirm_proposal", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "TOOL_NOT_FOUND" },
    });
  });

  it("rejects invalid proposal input and output without providing storage behavior", async () => {
    const invalidInputHandler = vi.fn();
    const inputRegistry = createProposalToolRegistry(invalidInputHandler);
    await expect(inputRegistry.run("create_proposal", { intent_type: "" })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT" },
    });
    expect(invalidInputHandler).not.toHaveBeenCalled();

    const invalidOutputHandler = vi.fn(() => ({ id: "proposal-1", status: "OPEN" }) as never);
    const outputRegistry = createProposalToolRegistry(invalidOutputHandler);
    await expect(
      outputRegistry.run("create_proposal", {
        intent_type: "SELL_ITEM",
        human_summary_pl: "Sprzedaj przedmiot.",
        payload: { item: "Pierścień" },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "TOOL_OUTPUT_INVALID" } });
    expect(invalidOutputHandler).toHaveBeenCalledOnce();
    const invalidStatusHandler = vi.fn(() => ({
      id: "proposal-1",
      intent_type: "SELL_ITEM",
      human_summary_pl: "Sprzedaj przedmiot.",
      payload: { item: "Pierścień" },
      status: "CONFIRMED" as const,
      created_at: "2026-09-01T12:00:00.000Z",
      expires_at: "2026-09-01T12:05:00.000Z",
    }));
    const invalidStatusRegistry = createProposalToolRegistry(invalidStatusHandler);
    await expect(
      invalidStatusRegistry.run("create_proposal", {
        intent_type: "SELL_ITEM",
        human_summary_pl: "Sprzedaj przedmiot.",
        payload: { item: "Pierścień" },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "TOOL_OUTPUT_INVALID" } });
    expect(invalidStatusHandler).toHaveBeenCalledOnce();
    expect(inputRegistry).not.toHaveProperty("confirm");
    expect(inputRegistry).not.toHaveProperty("store");
    expect(inputRegistry).not.toHaveProperty("consume");
  });

  it("does not call the authorizer or handler for invalid provider input", async () => {
    const authorizer = { authorize: vi.fn() };
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), authorizer);

    await expect(
      registry.invoke("mark_item_sold", { item: "", confirmation: { proposal_id: "p" } }, {}),
    ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_TOOL_INPUT" } });
    expect(authorizer.authorize).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects an unknown mutation name before authorization and handler lookup", async () => {
    const authorizer = { authorize: vi.fn() };
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), authorizer);

    await expect(
      registry.invoke("unknown_mutation" as MutationToolName, proposalInput, {}),
    ).resolves.toMatchObject({ ok: false, error: { code: "TOOL_NOT_FOUND" } });
    expect(authorizer.authorize).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("requires out-of-band context and never presents it in provider-visible input", async () => {
    const authorizer = { authorize: vi.fn() };
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), authorizer);

    const compileTimeOnly = (): void => {
      // @ts-expect-error An authorization context is a required third argument.
      void registry.invoke("mark_item_sold", directFactInput);
    };
    void compileTimeOnly;

    const result = await registry.invoke(
      "mark_item_sold",
      directFactInput,
      undefined as unknown as Record<string, never>,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });
    expect(authorizer.authorize).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(
      MUTATION_TOOL_CATALOG[3]!.inputSchema.safeParse({
        ...directFactInput,
        authorizationContext: {},
      }).success,
    ).toBe(false);
  });

  it.each([
    ["expired", (context: FakeAuthorizationContext) => ({ ...context, expiresAt: NOW })],
    [
      "tool mismatch",
      (context: FakeAuthorizationContext) => ({ ...context, expectedTool: "equip_item" }),
    ],
    [
      "claim mismatch",
      (context: FakeAuthorizationContext) => ({
        ...context,
        expectedClaim: { mode: "PROPOSAL" as const, proposalId: "other" },
      }),
    ],
    ["ambiguous", (context: FakeAuthorizationContext) => ({ ...context, ambiguous: true })],
  ])("rejects %s authorization before its handler", async (_case, alter) => {
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), new FakeAuthorizer());
    const base = contextFor("mark_item_sold", proposalInput, {
      mode: "PROPOSAL",
      proposalId: "proposal-1",
    });

    const result = await registry.invoke("mark_item_sold", proposalInput, alter(base));
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("Pierścień Blasku");
    expect(JSON.stringify(result)).not.toContain("authorization-1");
    expect(handler).not.toHaveBeenCalled();
  });

  it("invalidates authorization when arguments are mutated after issuance", async () => {
    const input: { item: string; confirmation: { proposal_id: string } } = {
      item: "Pierścień Blasku",
      confirmation: { proposal_id: "proposal-1" },
    };
    const context = contextFor("mark_item_sold", input, {
      mode: "PROPOSAL",
      proposalId: "proposal-1",
    });
    input.item = "Inny przedmiot";
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), new FakeAuthorizer());

    await expect(registry.invoke("mark_item_sold", input, context)).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_INVALID", details: { reason: "PAYLOAD_MISMATCH" } },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    [proposalInput, { mode: "PROPOSAL" as const, proposalId: "proposal-1" }],
    [
      directFactInput,
      {
        mode: "DIRECT_FACT" as const,
        sourceUtterance: "Sprzedałem Pierścień Blasku.",
      },
    ],
  ])(
    "lets one valid fake authorization reach exactly one fake handler %#",
    async (input, claim) => {
      const handler = vi.fn(() => receipt);
      const registry = createMutationToolRegistry(handlers(handler), new FakeAuthorizer());
      const context = contextFor("mark_item_sold", input, claim);

      await expect(registry.invoke("mark_item_sold", input, context)).resolves.toEqual({
        ok: true,
        data: receipt,
        warnings: [],
      });
      expect(handler).toHaveBeenCalledOnce();

      await expect(registry.invoke("mark_item_sold", input, context)).resolves.toMatchObject({
        ok: false,
        error: { code: "CONFIRMATION_INVALID", details: { reason: "REPLAYED" } },
      });
      expect(handler).toHaveBeenCalledOnce();
    },
  );

  it("keeps fabricated direct-fact suggestion metadata outside canonical state", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bg3-m4-fabricated-direct-fact-"));
    temporaryDirectories.push(directory);
    const filename = join(directory, "campaign.sqlite");
    const connection = openMigratedSqliteConnection({ filename });
    seedM3CampaignFixture(connection.database);
    const beforeCounts = connection.database.$client
      .prepare(
        "select (select count(*) from change_events) as events, (select count(*) from checkpoints) as checkpoints",
      )
      .get() as { events: number; checkpoints: number };
    connection.close();
    const beforeBytes = createHash("sha256").update(readFileSync(filename)).digest("hex");
    const application = openM4CampaignApplication({ filename });
    expect(Object.keys(application).sort()).toEqual(["close", "readTools"]);
    application.close();

    const fabricated = {
      item: "Pierścień Blasku",
      confirmation: {
        direct_fact: true,
        source_utterance: "Może sprzedaj Pierścień Blasku.",
      },
    } as const;
    const handler = vi.fn(() => receipt);
    const registry = createMutationToolRegistry(handlers(handler), new FakeAuthorizer());
    const context = {
      ...contextFor("mark_item_sold", fabricated, {
        mode: "DIRECT_FACT",
        sourceUtterance: fabricated.confirmation.source_utterance,
      }),
      ambiguous: true,
    };
    await expect(registry.invoke("mark_item_sold", fabricated, context)).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_REQUIRED" },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(createHash("sha256").update(readFileSync(filename)).digest("hex")).toBe(beforeBytes);
    const verification = openMigratedSqliteConnection({ filename });
    const afterCounts = verification.database.$client
      .prepare(
        "select (select count(*) from change_events) as events, (select count(*) from checkpoints) as checkpoints",
      )
      .get() as { events: number; checkpoints: number };
    verification.close();
    expect(afterCounts).toEqual(beforeCounts);
  });
});

describe("canonical mutation authorization payload digest", () => {
  it("is SHA-256, key-order independent and sensitive to every nested value", () => {
    const first = canonicalJsonDigest({ z: 1, nested: { b: true, a: ["x", null] } });
    const reordered = canonicalJsonDigest({ nested: { a: ["x", null], b: true }, z: 1 });
    const changed = canonicalJsonDigest({ nested: { a: ["y", null], b: true }, z: 1 });
    const reorderedArray = canonicalJsonDigest({ nested: { a: [null, "x"], b: true }, z: 1 });
    const expected = createHash("sha256")
      .update('bg3-mutation-payload-v1\n{"nested":{"a":["x",null],"b":true},"z":1}', "utf8")
      .digest("hex");
    expect(first).toBe(`sha256:${expected}`);
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
    expect(reorderedArray).not.toBe(first);
  });
});
