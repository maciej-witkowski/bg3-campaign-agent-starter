import type { z } from "zod";

import { CampaignInspectionError } from "../../application/inspection/campaign-inspection.js";
import type { CampaignReadToolPort } from "../../application/tools/campaign-read-tools.js";
import { CampaignToolQueryError } from "../../application/tools/campaign-read-tools.js";
import {
  READ_TOOL_CATALOG,
  assertValidReadToolCatalog,
  type ReadToolDefinition,
  type ReadToolName,
} from "../catalog/read-tool-catalog.js";
import type { JsonValue, ToolResult } from "../contracts/domain-contracts.js";
import {
  executeTool,
  type ToolBeforeInvokeContext,
  type ToolExecutionObserver,
} from "../execution/tool-executor.js";
import type { SafeToolError } from "../execution/tool-errors.js";
import { toolFailure } from "../execution/tool-result.js";

export interface ReadToolRunner {
  readonly definition: ReadToolDefinition;
  run(input: unknown): Promise<ToolResult>;
}

export interface ReadToolRegistry {
  list(): readonly ReadToolDefinition[];
  get(name: string): ReadToolRunner | undefined;
  run(name: string, input: unknown): Promise<ToolResult>;
}

export interface ReadToolRegistryOptions {
  readonly beforeInvoke?: (context: ToolBeforeInvokeContext<unknown>) => void | Promise<void>;
  readonly observer?: ToolExecutionObserver;
}

type Handler = (input: never) => JsonValue | Promise<JsonValue>;

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
  options: ReadToolRegistryOptions = {},
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
        run(input: unknown): Promise<ToolResult> {
          return executeTool<never, JsonValue>({
            definition: entry,
            input,
            handler,
            ...(options.beforeInvoke === undefined
              ? {}
              : {
                  beforeInvoke: options.beforeInvoke as (
                    context: ToolBeforeInvokeContext<never>,
                  ) => void | Promise<void>,
                }),
            ...(options.observer === undefined ? {} : { observer: options.observer }),
            mapError: mapReadToolError,
          });
        },
      }),
    );
  }
  const listed = Object.freeze([...catalog]);
  return Object.freeze({
    list: () => listed,
    get: (name: string) => runners.get(name),
    run: (name: string, input: unknown) =>
      runners.get(name)?.run(input) ??
      Promise.resolve(
        toolFailure("TOOL_NOT_FOUND", "Nie znaleziono narzędzia.", {
          details: { tool_name: name.slice(0, 100) },
        }),
      ),
  });
}

export function parseToolData<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}

function mapReadToolError(error: unknown): SafeToolError | undefined {
  if (error instanceof CampaignToolQueryError) {
    if (error.code === "NOT_FOUND") return { code: "NOT_FOUND", message_pl: error.message };
    if (error.code === "AMBIGUOUS") return { code: "AMBIGUOUS", message_pl: error.message };
    return { code: "INVALID_TOOL_INPUT", message_pl: error.message };
  }
  if (error instanceof CampaignInspectionError) {
    switch (error.code) {
      case "CHARACTER_NOT_FOUND":
        return { code: "NOT_FOUND", message_pl: error.message };
      case "CHARACTER_AMBIGUOUS":
        return { code: "AMBIGUOUS", message_pl: error.message };
      case "INVALID_FILTER":
      case "INVALID_LIMIT":
        return { code: "INVALID_TOOL_INPUT", message_pl: error.message };
      case "INCONSISTENT_STATE":
        return { code: "CONFLICT", message_pl: error.message };
    }
  }
  return undefined;
}
