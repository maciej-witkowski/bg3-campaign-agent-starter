import type { z } from "zod";

import { createProposalOutputSchema } from "../contracts/domain-contracts.js";
import { createProposalInputSchema } from "../contracts/tool-input-contracts.js";

export type ProposalToolName = "create_proposal";

export interface ProposalToolDefinition {
  readonly name: ProposalToolName;
  readonly category: "proposal";
  readonly descriptionPl: string;
  readonly milestone: "M4";
  readonly availability: "EXECUTABLE";
  readonly inputSchema: z.ZodType;
  readonly outputSchema: z.ZodType;
}

export const PROPOSAL_TOOL_CATALOG: readonly ProposalToolDefinition[] = Object.freeze([
  Object.freeze({
    name: "create_proposal",
    category: "proposal",
    descriptionPl: "Tworzy efemeryczną, niezatwierdzoną propozycję zmiany.",
    milestone: "M4",
    availability: "EXECUTABLE",
    inputSchema: createProposalInputSchema,
    outputSchema: createProposalOutputSchema,
  }),
]);

export function assertValidProposalToolCatalog(catalog: readonly ProposalToolDefinition[]): void {
  const names = new Set<string>();
  for (const entry of catalog) {
    if (names.has(entry.name)) throw new Error(`Duplicate tool definition: ${entry.name}`);
    names.add(entry.name);
    if (entry.category !== "proposal")
      throw new Error(`Unsupported proposal-registry category: ${String(entry.category)}`);
    if (entry.inputSchema === undefined || entry.outputSchema === undefined)
      throw new Error(`Missing schema for tool: ${entry.name}`);
  }
}

assertValidProposalToolCatalog(PROPOSAL_TOOL_CATALOG);
