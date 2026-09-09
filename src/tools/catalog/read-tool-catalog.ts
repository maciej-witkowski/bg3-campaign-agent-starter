import type { z } from "zod";

import {
  calculateEffectiveAttributesInputSchema,
  compareEquipmentInputSchema,
  findEquipmentCandidatesInputSchema,
  findInventoryItemsInputSchema,
  getCharacterBuildInputSchema,
  getCharacterEquipmentInputSchema,
  getCharacterInputSchema,
  getCharacterSpellsInputSchema,
  getIllithidStateInputSchema,
  getItemInputSchema,
  getPartyInputSchema,
  getRecentChangesInputSchema,
  validateCampaignStateInputSchema,
} from "../contracts/tool-input-contracts.js";
import {
  calculateEffectiveAttributesOutputSchema,
  compareEquipmentOutputSchema,
  findEquipmentCandidatesOutputSchema,
  findInventoryItemsOutputSchema,
  getCharacterBuildOutputSchema,
  getCharacterEquipmentOutputSchema,
  getCharacterOutputSchema,
  getCharacterSpellsOutputSchema,
  getIllithidStateOutputSchema,
  getItemOutputSchema,
  getPartyOutputSchema,
  getRecentChangesOutputSchema,
  validateCampaignStateOutputSchema,
} from "../contracts/read-tool-output-contracts.js";

export type ReadToolCategory = "read" | "analysis";
export type ReadToolName =
  | "get_party"
  | "get_character"
  | "get_character_build"
  | "get_character_equipment"
  | "find_inventory_items"
  | "get_item"
  | "get_character_spells"
  | "get_illithid_state"
  | "get_recent_changes"
  | "compare_equipment"
  | "calculate_effective_attributes"
  | "find_equipment_candidates"
  | "validate_campaign_state";

export interface ReadToolDefinition {
  readonly name: ReadToolName;
  readonly category: ReadToolCategory;
  readonly descriptionPl: string;
  readonly milestone: "M4";
  readonly availability: "EXECUTABLE";
  readonly inputSchema: z.ZodType;
  readonly outputSchema: z.ZodType;
}

function definition(value: ReadToolDefinition): ReadToolDefinition {
  return Object.freeze(value);
}

const definitions = [
  definition({
    name: "get_party",
    category: "read",
    descriptionPl: "Pobiera aktywną drużynę i jej atrybuty.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getPartyInputSchema,
    outputSchema: getPartyOutputSchema,
  }),
  definition({
    name: "get_character",
    category: "read",
    descriptionPl: "Pobiera podstawowy zapis wskazanej postaci.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getCharacterInputSchema,
    outputSchema: getCharacterOutputSchema,
  }),
  definition({
    name: "get_character_build",
    category: "read",
    descriptionPl: "Pobiera zarejestrowany build postaci.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getCharacterBuildInputSchema,
    outputSchema: getCharacterBuildOutputSchema,
  }),
  definition({
    name: "get_character_equipment",
    category: "read",
    descriptionPl: "Pobiera wyposażenie postaci.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getCharacterEquipmentInputSchema,
    outputSchema: getCharacterEquipmentOutputSchema,
  }),
  definition({
    name: "find_inventory_items",
    category: "read",
    descriptionPl: "Wyszukuje posiadane egzemplarze przedmiotów po jawnych filtrach.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: findInventoryItemsInputSchema,
    outputSchema: findInventoryItemsOutputSchema,
  }),
  definition({
    name: "get_item",
    category: "read",
    descriptionPl: "Pobiera jednoznacznie wskazaną definicję i jej egzemplarze.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getItemInputSchema,
    outputSchema: getItemOutputSchema,
  }),
  definition({
    name: "get_character_spells",
    category: "read",
    descriptionPl: "Pobiera zarejestrowane czary postaci.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getCharacterSpellsInputSchema,
    outputSchema: getCharacterSpellsOutputSchema,
  }),
  definition({
    name: "get_illithid_state",
    category: "read",
    descriptionPl: "Pobiera zapis mocy illithidów.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getIllithidStateInputSchema,
    outputSchema: getIllithidStateOutputSchema,
  }),
  definition({
    name: "get_recent_changes",
    category: "read",
    descriptionPl: "Pobiera ograniczone podsumowania ostatnich zmian.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: getRecentChangesInputSchema,
    outputSchema: getRecentChangesOutputSchema,
  }),
  definition({
    name: "compare_equipment",
    category: "analysis",
    descriptionPl: "Zestawia zapisane fakty o kandydacie i obecnym wyposażeniu.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: compareEquipmentInputSchema,
    outputSchema: compareEquipmentOutputSchema,
  }),
  definition({
    name: "calculate_effective_attributes",
    category: "analysis",
    descriptionPl: "Wylicza efektywne atrybuty z zapisanych modyfikatorów.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: calculateEffectiveAttributesInputSchema,
    outputSchema: calculateEffectiveAttributesOutputSchema,
  }),
  definition({
    name: "find_equipment_candidates",
    category: "analysis",
    descriptionPl: "Znajduje kandydatów po slocie i jawnych typach efektów.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: findEquipmentCandidatesInputSchema,
    outputSchema: findEquipmentCandidatesOutputSchema,
  }),
  definition({
    name: "validate_campaign_state",
    category: "analysis",
    descriptionPl: "Waliduje kanoniczny stan kampanii.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: validateCampaignStateInputSchema,
    outputSchema: validateCampaignStateOutputSchema,
  }),
] as const;

export const READ_TOOL_CATALOG: readonly ReadToolDefinition[] = Object.freeze(definitions);

export function assertValidReadToolCatalog(catalog: readonly ReadToolDefinition[]): void {
  const names = new Set<string>();
  for (const entry of catalog) {
    if (names.has(entry.name)) throw new Error(`Duplicate tool definition: ${entry.name}`);
    names.add(entry.name);
    if (entry.category !== "read" && entry.category !== "analysis")
      throw new Error(`Unsupported read-registry category: ${String(entry.category)}`);
    if (entry.inputSchema === undefined || entry.outputSchema === undefined)
      throw new Error(`Missing schema for tool: ${entry.name}`);
  }
}

assertValidReadToolCatalog(READ_TOOL_CATALOG);
