import type { z } from "zod";

import { mutationReceiptSchema } from "../contracts/domain-contracts.js";
import {
  addCharacterAbilityInputSchema,
  addOwnedItemInputSchema,
  applyPermanentModifierInputSchema,
  createCheckpointInputSchema,
  equipItemInputSchema,
  markItemSoldInputSchema,
  moveItemToChestInputSchema,
  revertChangeInputSchema,
  setPreparedSpellsInputSchema,
  unlockIllithidPowerInputSchema,
} from "../contracts/tool-input-contracts.js";

export const MUTATION_TOOL_NAMES = [
  "add_owned_item",
  "equip_item",
  "move_item_to_chest",
  "mark_item_sold",
  "set_prepared_spells",
  "add_character_ability",
  "unlock_illithid_power",
  "apply_permanent_modifier",
  "create_checkpoint",
  "revert_change",
] as const;

export type MutationToolName = (typeof MUTATION_TOOL_NAMES)[number];

export interface MutationToolDefinition {
  readonly name: MutationToolName;
  readonly category: "mutation";
  readonly descriptionPl: string;
  readonly milestone: "M4";
  readonly availability: "CONTRACT_ONLY";
  readonly inputSchema: z.ZodType;
  readonly outputSchema: typeof mutationReceiptSchema;
}

function definition(
  name: MutationToolName,
  descriptionPl: string,
  inputSchema: z.ZodType,
): MutationToolDefinition {
  return Object.freeze({
    name,
    category: "mutation",
    descriptionPl,
    milestone: "M4",
    availability: "CONTRACT_ONLY",
    inputSchema,
    outputSchema: mutationReceiptSchema,
  });
}

export const MUTATION_TOOL_CATALOG: readonly MutationToolDefinition[] = Object.freeze([
  definition("add_owned_item", "Dodaje potwierdzony posiadany przedmiot.", addOwnedItemInputSchema),
  definition("equip_item", "Zakłada potwierdzony egzemplarz przedmiotu.", equipItemInputSchema),
  definition(
    "move_item_to_chest",
    "Przenosi potwierdzony przedmiot do skrzyni.",
    moveItemToChestInputSchema,
  ),
  definition(
    "mark_item_sold",
    "Oznacza potwierdzony przedmiot jako sprzedany.",
    markItemSoldInputSchema,
  ),
  definition(
    "set_prepared_spells",
    "Ustawia potwierdzoną listę przygotowanych czarów.",
    setPreparedSpellsInputSchema,
  ),
  definition(
    "add_character_ability",
    "Dodaje potwierdzoną zdolność postaci.",
    addCharacterAbilityInputSchema,
  ),
  definition(
    "unlock_illithid_power",
    "Odblokowuje potwierdzoną moc illithidów.",
    unlockIllithidPowerInputSchema,
  ),
  definition(
    "apply_permanent_modifier",
    "Stosuje potwierdzony trwały modyfikator.",
    applyPermanentModifierInputSchema,
  ),
  definition("create_checkpoint", "Tworzy potwierdzony checkpoint.", createCheckpointInputSchema),
  definition("revert_change", "Odwraca potwierdzoną zmianę.", revertChangeInputSchema),
]);

export function assertValidMutationToolCatalog(catalog: readonly MutationToolDefinition[]): void {
  const names = new Set<string>();
  for (const entry of catalog) {
    if (names.has(entry.name)) throw new Error(`Duplicate tool definition: ${entry.name}`);
    names.add(entry.name);
    if (entry.category !== "mutation")
      throw new Error(`Unsupported mutation-registry category: ${String(entry.category)}`);
    if (entry.inputSchema === undefined || entry.outputSchema === undefined)
      throw new Error(`Missing schema for tool: ${entry.name}`);
  }
}

assertValidMutationToolCatalog(MUTATION_TOOL_CATALOG);
