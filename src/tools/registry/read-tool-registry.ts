import type { z } from "zod";

import type { CampaignReadToolPort } from "../../application/tools/campaign-read-tools.js";
import {
  READ_TOOL_CATALOG,
  assertValidReadToolCatalog,
  type ReadToolDefinition,
  type ReadToolName,
} from "../catalog/read-tool-catalog.js";

export interface ReadToolRunner {
  readonly definition: ReadToolDefinition;
  run(input: unknown): unknown;
}

export interface ReadToolRegistry {
  list(): readonly ReadToolDefinition[];
  get(name: string): ReadToolRunner | undefined;
}

type Handler = (input: never) => unknown;

const handlers = (port: CampaignReadToolPort): Readonly<Record<ReadToolName, Handler>> => ({
  get_party: (input) => port.getParty(input),
  get_character: (input) => port.getCharacter(input),
  get_character_build: (input) => port.getCharacterBuild(input),
  get_character_equipment: (input) => port.getCharacterEquipment(input),
  find_inventory_items: (input) => port.findInventoryItems(input),
  get_item: (input) => port.getItem(input),
  get_character_spells: (input) => port.getCharacterSpells(input),
  get_illithid_state: (input) => port.getIllithidState(input),
  get_recent_changes: (input) => port.getRecentChanges(input),
  compare_equipment: (input) => port.compareEquipment(input),
  calculate_effective_attributes: (input) => port.calculateEffectiveAttributes(input),
  find_equipment_candidates: (input) => port.findEquipmentCandidates(input),
  validate_campaign_state: (input) => port.validateCampaignState(input),
});

export function createReadToolRegistry(
  port: CampaignReadToolPort,
  catalog: readonly ReadToolDefinition[] = READ_TOOL_CATALOG,
): ReadToolRegistry {
  assertValidReadToolCatalog(catalog);
  const supplied = handlers(port);
  const names = new Set(catalog.map((entry) => entry.name));
  for (const name of Object.keys(supplied) as ReadToolName[])
    if (!names.has(name)) throw new Error(`Undeclared read tool handler: ${name}`);
  const runners = new Map<string, ReadToolRunner>();
  for (const entry of catalog) {
    const handler = supplied[entry.name];
    if (handler === undefined) throw new Error(`Missing read tool handler: ${entry.name}`);
    runners.set(
      entry.name,
      Object.freeze({
        definition: entry,
        run(input: unknown): unknown {
          const parsed = entry.inputSchema.parse(input) as never;
          return entry.outputSchema.parse(handler(parsed));
        },
      }),
    );
  }
  const listed = Object.freeze([...catalog]);
  return Object.freeze({ list: () => listed, get: (name: string) => runners.get(name) });
}

export function parseToolData<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
