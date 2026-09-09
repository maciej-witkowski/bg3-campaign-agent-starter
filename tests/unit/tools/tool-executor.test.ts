import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ReadToolDefinition } from "../../../src/tools/catalog/read-tool-catalog.js";
import { executeTool } from "../../../src/tools/execution/tool-executor.js";
import {
  ExpectedToolError,
  SHARED_TOOL_ERROR_CODES,
} from "../../../src/tools/execution/tool-errors.js";
import { toolFailure, toolSuccess } from "../../../src/tools/execution/tool-result.js";

const definition: ReadToolDefinition = Object.freeze({
  name: "get_character",
  category: "read",
  descriptionPl: "test",
  milestone: "M4",
  availability: "EXECUTABLE",
  inputSchema: z.object({ character: z.string().min(1) }).strict(),
  outputSchema: z.object({ name: z.string(), at: z.iso.datetime({ offset: true }) }).strict(),
});

describe("M4 schema-first tool executor", () => {
  it("runs input, neutral precondition, async handler, output and envelope in order", async () => {
    const order: string[] = [];
    const result = await executeTool<{ character: string }, { name: string; at: string }>({
      definition,
      input: { character: "Lae'zel" },
      beforeInvoke: async ({ input }) => {
        order.push(`before:${input.character}`);
      },
      handler: async (input) => {
        order.push(`handler:${input.character}`);
        return { name: input.character, at: "2026-09-01T10:00:00.000Z" };
      },
    });

    expect(order).toEqual(["before:Lae'zel", "handler:Lae'zel"]);
    expect(result).toEqual({
      ok: true,
      data: { name: "Lae'zel", at: "2026-09-01T10:00:00.000Z" },
      warnings: [],
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("rejects invalid input before the precondition and handler", async () => {
    const beforeInvoke = vi.fn();
    const handler = vi.fn();
    const result = await executeTool({
      definition,
      input: { character: "", secret: "do not echo" },
      beforeInvoke,
      handler,
    });

    expect(beforeInvoke).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT", message_pl: "Nieprawidłowe argumenty narzędzia." },
      warnings: [],
    });
    expect(JSON.stringify(result)).not.toContain("do not echo");
  });

  it.each([
    [undefined, "TOOL_OUTPUT_INVALID"],
    [{ name: "Lae'zel", at: "nie-data" }, "TOOL_OUTPUT_INVALID"],
    [{ name: "Lae'zel", at: "2026-09-01T10:00:00.000Z", extra: true }, "TOOL_OUTPUT_INVALID"],
    [{ name: "Lae'zel", at: "2026-09-01T10:00:00.000Z", value: 1n }, "TOOL_OUTPUT_INVALID"],
  ])("rejects malformed or non-JSON handler output %#", async (output, code) => {
    const result = await executeTool({
      definition,
      input: { character: "Lae'zel" },
      handler: () => output as never,
    });
    expect(result).toMatchObject({ ok: false, error: { code }, warnings: [] });
  });

  it("maps expected failures and redacts thrown/rejected private diagnostics", async () => {
    const expected = await executeTool({
      definition,
      input: { character: "Lae'zel" },
      handler: () => {
        throw new ExpectedToolError({ code: "NOT_FOUND", message_pl: "Nie znaleziono postaci." });
      },
    });
    expect(expected).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message_pl: "Nie znaleziono postaci." },
      warnings: [],
    });

    const privateText = "SELECT * FROM secrets; token=private";
    const unexpected = await executeTool({
      definition,
      input: { character: "Lae'zel" },
      handler: () => Promise.reject(new Error(privateText)),
    });
    expect(unexpected).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message_pl: "Wystąpił nieoczekiwany błąd narzędzia." },
      warnings: [],
    });
    expect(JSON.stringify(unexpected)).not.toContain(privateText);
  });

  it("keeps observer metadata bounded and ignores observer failures", async () => {
    const observer = vi.fn(() => {
      throw new Error("observer offline");
    });
    const result = await executeTool({
      definition,
      input: { character: "Lae'zel" },
      handler: () => {
        throw new Error("SQL and campaign snapshot");
      },
      observer,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(observer).toHaveBeenCalledWith({
      toolName: "get_character",
      stage: "handler",
      code: "INTERNAL_ERROR",
      unexpected: true,
    });
  });

  it.each(["precondition", "handler"] as const)(
    "contains a throwing error mapper after a %s failure",
    async (stage) => {
      const privateText = "mapper token=private";
      const result = await executeTool({
        definition,
        input: { character: "Lae'zel" },
        ...(stage === "precondition"
          ? {
              beforeInvoke: () => {
                throw new Error("precondition failed");
              },
            }
          : {}),
        handler: () => {
          throw new Error("handler failed");
        },
        mapError: () => {
          throw new Error(privateText);
        },
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "INTERNAL_ERROR", message_pl: "Wystąpił nieoczekiwany błąd narzędzia." },
        warnings: [],
      });
      expect(JSON.stringify(result)).not.toContain(privateText);
    },
  );

  it.each([
    [
      z.any().superRefine(() => {
        throw new Error("refinement token=private");
      }),
      {},
    ],
    [
      definition.outputSchema,
      new Proxy(
        {},
        {
          get: () => {
            throw new Error("getter token=private");
          },
        },
      ),
    ],
  ])("contains exceptions raised during output validation %#", async (outputSchema, output) => {
    const result = await executeTool({
      definition: { ...definition, outputSchema },
      input: { character: "Lae'zel" },
      handler: () => output as never,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message_pl: "Wystąpił nieoczekiwany błąd narzędzia." },
      warnings: [],
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("constructs exact mutually exclusive envelopes and bounds warnings", () => {
    expect(toolSuccess({ text: "Zażółć" }, ["uwaga"])).toEqual({
      ok: true,
      data: { text: "Zażółć" },
      warnings: ["uwaga"],
    });
    expect(toolFailure("CONFLICT", "Sprzeczne fakty.")).toEqual({
      ok: false,
      error: { code: "CONFLICT", message_pl: "Sprzeczne fakty." },
      warnings: [],
    });
  });

  it.each(SHARED_TOOL_ERROR_CODES)("constructs the stable %s failure family", (code) => {
    expect(toolFailure(code, "Bezpieczny komunikat.")).toEqual({
      ok: false,
      error: { code, message_pl: "Bezpieczny komunikat." },
      warnings: [],
    });
  });

  it("rejects a cyclic payload even when a lower-level output schema is permissive", async () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const permissive = { ...definition, outputSchema: z.any() };
    const result = await executeTool({
      definition: permissive,
      input: { character: "Lae'zel" },
      handler: () => cycle as never,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "TOOL_OUTPUT_INVALID" } });
  });

  it("allowlists and bounds public error details", () => {
    const result = toolFailure("CONFLICT", "Sprzeczne fakty.", {
      details: {
        tool_name: "x".repeat(1_000),
        reason: "jawny powód",
        secret: "token prywatny",
      },
    });
    expect(result).toMatchObject({
      error: { details: { tool_name: "x".repeat(500), reason: "jawny powód" } },
    });
    expect(JSON.stringify(result)).not.toContain("token prywatny");
  });
});
