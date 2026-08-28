import { describe, expect, it } from "vitest";

import {
  createImportedItemFingerprint,
  mapLegacyAbilityType,
  mapLegacyEquipmentSlot,
  mapLegacyInventoryStatus,
  mapLegacyItemSlot,
  mapLegacyPrepared,
  mapLegacySpellSource,
  mapLegacyVerificationStatus,
  mapLegacyYesNo,
  normalizePolishMatchingKey,
} from "../../../src/application/import/legacy-normalization.js";

describe("legacy import normalization", () => {
  it("normalizes only the matching aid and preserves Polish distinctions", () => {
    expect(normalizePolishMatchingKey("  PIERŚCIEŃ\t  ŁOWCY  ")).toBe("pierścień łowcy");
    expect(normalizePolishMatchingKey("Lae'zel")).toBe("lae'zel");
    expect(normalizePolishMatchingKey("Selûne")).toBe("selûne");
    expect(normalizePolishMatchingKey("S\u0301wiatło")).toBe("światło");
  });

  it("maps every closed legacy value domain used by the tracker", () => {
    expect(mapLegacyInventoryStatus("WYPOSAŻONY")).toBe("EQUIPPED");
    expect(mapLegacyInventoryStatus("FABULARNY / OSOBISTY")).toBe("PERSONAL_STORY");
    expect(mapLegacyEquipmentSlot("Pierścień 2")).toBe("RING_2");
    expect(mapLegacyItemSlot("Pierścień 2")).toBe("RING");
    expect(mapLegacyAbilityType("Mistyczna Inwokacja")).toBe("INVOCATION");
    expect(mapLegacySpellSource("Księga Maga")).toBe("SPELLBOOK");
    expect(mapLegacyVerificationStatus("DO WERYFIKACJI")).toBe("UNVERIFIED");
    expect(mapLegacyVerificationStatus("POTWIERDZONE W GRZE")).toBe("VERIFIED");
    expect(mapLegacyYesNo("TAK")).toBe(true);
    expect(mapLegacyYesNo("NIE")).toBe(false);
    expect(mapLegacyPrepared("N/D")).toBe(false);
  });

  it("returns null for unknown tokens instead of guessing", () => {
    expect(mapLegacyInventoryStatus("WYPOSAŻONY? ")).toBeNull();
    expect(mapLegacyEquipmentSlot("Pierścień")).toBeNull();
    expect(mapLegacyAbilityType("Inwokacja podobna")).toBeNull();
    expect(mapLegacySpellSource("Czar z pamięci")).toBeNull();
    expect(mapLegacyVerificationStatus("RACZEJ POTWIERDZONE")).toBeNull();
    expect(mapLegacyYesNo("PRAWIE")).toBeNull();
  });

  it("creates versioned deterministic fingerprints from material exact facts", () => {
    const input = {
      namePl: "Hełm Pięścią Łamacza",
      typePl: "Wyposażenie",
      slot: "HEAD",
      rarityPl: null,
      verificationStatus: "VERIFIED",
      effectDescriptionsPl: ["+1 do ST czarów", "+1 do inicjatywy"],
    } as const;
    const first = createImportedItemFingerprint(input);

    expect(first).toMatch(/^import-v1:[0-9a-f]{64}$/u);
    expect(createImportedItemFingerprint(input)).toBe(first);
    expect(
      createImportedItemFingerprint({
        ...input,
        effectDescriptionsPl: [...input.effectDescriptionsPl].reverse(),
      }),
    ).not.toBe(first);
    expect(createImportedItemFingerprint({ ...input, namePl: "hełm Pięścią Łamacza" })).not.toBe(
      first,
    );
  });
});
