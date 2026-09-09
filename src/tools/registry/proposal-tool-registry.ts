import type { CreateProposalInput } from "../contracts/tool-input-contracts.js";
import type { CreateProposalOutput, ToolResult } from "../contracts/domain-contracts.js";
import {
  PROPOSAL_TOOL_CATALOG,
  assertValidProposalToolCatalog,
  type ProposalToolDefinition,
} from "../catalog/proposal-tool-catalog.js";
import { executeTool, type ToolExecutionObserver } from "../execution/tool-executor.js";
import { toolFailure } from "../execution/tool-result.js";

export type ProposalToolHandler = (
  input: CreateProposalInput,
) => CreateProposalOutput | Promise<CreateProposalOutput>;

export interface ProposalToolRegistry {
  list(): readonly ProposalToolDefinition[];
  run(name: string, input: unknown): Promise<ToolResult<CreateProposalOutput>>;
}

export function createProposalToolRegistry(
  handler: ProposalToolHandler,
  options: { readonly observer?: ToolExecutionObserver } = {},
  catalog: readonly ProposalToolDefinition[] = PROPOSAL_TOOL_CATALOG,
): ProposalToolRegistry {
  assertValidProposalToolCatalog(catalog);
  const definition = catalog.find((entry) => entry.name === "create_proposal");
  if (definition === undefined)
    throw new Error("Missing proposal tool definition: create_proposal");
  if (catalog.length !== 1) throw new Error("Undeclared proposal tool definition");
  const listed = Object.freeze([...catalog]);
  return Object.freeze({
    list: () => listed,
    run: (name: string, input: unknown) =>
      name === "create_proposal"
        ? executeTool<CreateProposalInput, CreateProposalOutput>({
            definition,
            input,
            handler,
            ...(options.observer === undefined ? {} : { observer: options.observer }),
          })
        : Promise.resolve(
            toolFailure("TOOL_NOT_FOUND", "Nie znaleziono narzędzia.", {
              details: { tool_name: name.slice(0, 100) },
            }),
          ),
  });
}
