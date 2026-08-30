import { describe, expect, it } from "vitest";

import { cliFailure, cliSuccess, serializeCliEnvelope } from "../../../src/cli/cli-envelope.js";

describe("BG3_CLI_RESULT V1 envelope", () => {
  it("serializes a deterministic Unicode success document with one trailing newline", () => {
    const result = serializeCliEnvelope(
      cliSuccess("party", {
        displayNamePl: "Lae'zel",
        unknown: null,
        at: new Date("2026-08-30T12:00:00.000Z"),
      }),
    );

    expect(result.endsWith("\n")).toBe(true);
    expect(result.endsWith("\n\n")).toBe(false);
    expect(JSON.parse(result)).toEqual({
      format: "BG3_CLI_RESULT",
      version: 1,
      command: "party",
      ok: true,
      data: {
        displayNamePl: "Lae'zel",
        unknown: null,
        at: "2026-08-30T12:00:00.000Z",
      },
      warnings: [],
    });
    expect(result.indexOf('"data"')).toBeLessThan(result.indexOf('"warnings"'));
  });

  it("serializes a failure without a data field", () => {
    const parsed = JSON.parse(
      serializeCliEnvelope(
        cliFailure("character", {
          code: "CHARACTER_NOT_FOUND",
          messagePl: "Nie znaleziono postaci.",
          details: { name: "Brak" },
        }),
      ),
    ) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      format: "BG3_CLI_RESULT",
      version: 1,
      command: "character",
      ok: false,
      error: { code: "CHARACTER_NOT_FOUND" },
      warnings: [],
    });
    expect(parsed).not.toHaveProperty("data");
  });
});
