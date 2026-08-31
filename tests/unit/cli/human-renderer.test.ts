import { describe, expect, it } from "vitest";

import { renderHumanSuccess } from "../../../src/cli/human-renderer.js";

describe("renderHumanSuccess", () => {
  it("renders party base and effective attributes in human mode", () => {
    const output = renderHumanSuccess("party", {
      characters: [
        {
          id: "character-laezel",
          canonicalName: "laezel",
          displayNamePl: "Lae'zel",
          classPl: "Wojownik",
          subclassPl: "Mistrz Bitewny",
          level: 5,
          roleSummary: "Pierwsza linia",
          attributes: [
            { attribute: "STR", baseValue: 17, effectiveValue: 19 },
            { attribute: "DEX", baseValue: 13, effectiveValue: 13 },
          ],
        },
      ],
    });

    expect(output).toBe(
      "Aktywna drużyna\n- Lae'zel — Wojownik / Mistrz Bitewny 5 — Pierwsza linia — Atrybuty: STR 17 → 19, DEX 13 → 13\n",
    );
  });
});
