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

  it("renders permanent modifier details and an explicit empty marker", () => {
    const data = {
      character: {
        displayNamePl: "Lae'zel",
        canonicalName: "laezel",
        classPl: "Wojownik",
        subclassPl: null,
        level: 5,
      },
      attributes: [],
      permanentModifiers: [
        {
          targetKey: "STR",
          modifier: 2,
          sourceNamePl: "Lustro Utraty",
          provenanceType: "USER_CONFIRMED",
          active: true,
        },
      ],
      abilities: [],
    };

    expect(renderHumanSuccess("character", data)).toContain(
      "Modyfikatory trwałe:\n- STR: +2 — Lustro Utraty — pochodzenie: USER_CONFIRMED — aktywny: tak\n",
    );
    expect(renderHumanSuccess("character", { ...data, permanentModifiers: [] })).toContain(
      "Modyfikatory trwałe:\n— brak —\n",
    );
  });

  it("renders all spell assignment flags independently", () => {
    const output = renderHumanSuccess("spells", {
      character: { displayNamePl: "Lae'zel" },
      spells: [
        {
          definition: { level: 1, namePl: "Skok" },
          assignment: {
            source: "ITEM",
            known: false,
            prepared: false,
            alwaysPrepared: true,
          },
        },
      ],
    });

    expect(output).toBe(
      "Czary: Lae'zel\n- 1: Skok — ITEM — znany: nie — przygotowany: nie — zawsze przygotowany: tak\n",
    );
  });

  it("renders complete equipment effects and an explicit empty marker", () => {
    const baseItem = {
      assignment: { slot: "RING_1" },
      definition: { namePl: "Pierścień Blasku" },
      inventoryItem: { id: "inventory-ring" },
    };
    const effect = {
      effectType: "BONUS",
      numericValue: 2,
      diceExpression: null,
      damageType: "Promienne",
      trigger: "Trafienie",
      conditionTextPl: "Gdy cel jest oświetlony",
      durationTextPl: null,
      descriptionPl: "Premia do obrażeń",
      verificationStatus: "USER_CONFIRMED",
    };

    expect(
      renderHumanSuccess("equipment", {
        character: { displayNamePl: "Lae'zel" },
        items: [{ ...baseItem, effects: [effect] }],
      }),
    ).toContain(
      "efekty: typ: BONUS, wartość: 2, kości: nieznane, obrażenia: Promienne, wyzwalacz: Trafienie, warunek: Gdy cel jest oświetlony, czas: nieznane, opis: Premia do obrażeń, weryfikacja: USER_CONFIRMED",
    );
    expect(
      renderHumanSuccess("equipment", {
        character: { displayNamePl: "Lae'zel" },
        items: [{ ...baseItem, effects: [] }],
      }),
    ).toContain("efekty: brak");
  });

  it("renders inventory stack quantity", () => {
    expect(
      renderHumanSuccess("inventory", {
        filters: { slots: [], statuses: [], tags: [] },
        items: [
          {
            definition: { namePl: "Mikstura Leczenia" },
            inventoryItem: { status: "CARRIED", quantity: 4 },
            owner: { displayNamePl: "Lae'zel" },
            effects: [],
            equipment: null,
          },
        ],
      }),
    ).toBe("Inwentarz\n- Mikstura Leczenia — CARRIED — ilość: 4 — Lae'zel\n");
  });

  it("renders known illithid prerequisite edges", () => {
    const output = renderHumanSuccess("illithid", {
      character: null,
      powers: [
        {
          definition: { namePl: "Odpychający Wybuch", tier: 2 },
          prerequisitePowerIds: ["power-tier-1"],
          acquisition: null,
        },
      ],
    });

    expect(output).toBe(
      "Moce illithidów\n- Odpychający Wybuch — poziom 2 — wymagania: power-tier-1\n",
    );
  });
});
