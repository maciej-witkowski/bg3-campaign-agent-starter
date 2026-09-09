import type {
  JsonValue,
  MutationConfirmation,
  MutationReceipt,
  ToolResult,
} from "../contracts/domain-contracts.js";
import type {
  AddCharacterAbilityInput,
  AddOwnedItemInput,
  ApplyPermanentModifierInput,
  CreateCheckpointInput,
  EquipItemInput,
  MarkItemSoldInput,
  MoveItemToChestInput,
  RevertChangeInput,
  SetPreparedSpellsInput,
  UnlockIllithidPowerInput,
} from "../contracts/tool-input-contracts.js";
import {
  MUTATION_TOOL_CATALOG,
  assertValidMutationToolCatalog,
  type MutationToolDefinition,
  type MutationToolName,
} from "../catalog/mutation-tool-catalog.js";
import {
  canonicalJsonDigest,
  mutationAuthorizationClaim,
  type MutationAuthorizationPort,
} from "../authorization/mutation-authorization.js";
import { executeTool, type ToolExecutionObserver } from "../execution/tool-executor.js";
import { ExpectedToolError } from "../execution/tool-errors.js";
import { toolFailure } from "../execution/tool-result.js";

export interface MutationToolInputByName {
  readonly add_owned_item: AddOwnedItemInput;
  readonly equip_item: EquipItemInput;
  readonly move_item_to_chest: MoveItemToChestInput;
  readonly mark_item_sold: MarkItemSoldInput;
  readonly set_prepared_spells: SetPreparedSpellsInput;
  readonly add_character_ability: AddCharacterAbilityInput;
  readonly unlock_illithid_power: UnlockIllithidPowerInput;
  readonly apply_permanent_modifier: ApplyPermanentModifierInput;
  readonly create_checkpoint: CreateCheckpointInput;
  readonly revert_change: RevertChangeInput;
}

export type MutationToolHandlers = {
  readonly [Name in MutationToolName]: (
    input: MutationToolInputByName[Name],
  ) => MutationReceipt | Promise<MutationReceipt>;
};

export interface MutationToolRegistry<TContext> {
  list(): readonly MutationToolDefinition[];
  invoke<Name extends MutationToolName>(
    name: Name,
    input: unknown,
    authorizationContext: TContext,
  ): Promise<ToolResult<MutationReceipt>>;
}

type MutationInput = MutationToolInputByName[MutationToolName] & {
  readonly confirmation: MutationConfirmation;
};

export function createMutationToolRegistry<TContext>(
  handlers: MutationToolHandlers,
  authorizer: MutationAuthorizationPort<TContext>,
  options: { readonly observer?: ToolExecutionObserver } = {},
  catalog: readonly MutationToolDefinition[] = MUTATION_TOOL_CATALOG,
): MutationToolRegistry<TContext> {
  assertValidMutationToolCatalog(catalog);
  const names = new Set(catalog.map((entry) => entry.name));
  for (const name of Object.keys(handlers) as MutationToolName[])
    if (!names.has(name)) throw new Error(`Undeclared mutation tool handler: ${name}`);
  const definitions = new Map(catalog.map((entry) => [entry.name, entry]));
  for (const entry of catalog)
    if (handlers[entry.name] === undefined)
      throw new Error(`Missing mutation tool handler: ${entry.name}`);
  const listed = Object.freeze([...catalog]);

  return Object.freeze({
    list: () => listed,
    async invoke<Name extends MutationToolName>(
      name: Name,
      input: unknown,
      authorizationContext: TContext,
    ): Promise<ToolResult<MutationReceipt>> {
      const definition = definitions.get(name);
      if (definition === undefined)
        return toolFailure("TOOL_NOT_FOUND", "Nie znaleziono narzędzia.", {
          details: { tool_name: String(name).slice(0, 100) },
        });
      const handler = handlers[name] as (
        validatedInput: MutationInput,
      ) => MutationReceipt | Promise<MutationReceipt>;
      return executeTool<MutationInput, MutationReceipt>({
        definition,
        input,
        beforeInvoke: async ({ input: validatedInput }) => {
          if (authorizationContext === null || authorizationContext === undefined)
            throw new ExpectedToolError({
              code: "CONFIRMATION_REQUIRED",
              message_pl: "Brak zaufanego kontekstu autoryzacji zmiany.",
            });
          const decision = await authorizer.authorize(authorizationContext, {
            toolName: name,
            payloadDigest: canonicalJsonDigest(validatedInput as JsonValue),
            claim: mutationAuthorizationClaim(validatedInput.confirmation),
          });
          if (!decision.authorized)
            throw new ExpectedToolError({
              code: decision.code,
              message_pl:
                decision.code === "CONFIRMATION_REQUIRED"
                  ? "Zmiana wymaga potwierdzenia."
                  : "Potwierdzenie zmiany jest nieważne.",
              details: { reason: decision.reason },
            });
        },
        handler,
        ...(options.observer === undefined ? {} : { observer: options.observer }),
      });
    },
  });
}
