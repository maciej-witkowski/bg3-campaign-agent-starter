import { z } from "zod";

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

const nonBlankStringSchema = z.string().min(1).regex(/\S/u);

export const proposalConfirmationSchema = z.object({ proposal_id: nonBlankStringSchema }).strict();

export const directFactConfirmationSchema = z
  .object({
    direct_fact: z.literal(true),
    source_utterance: nonBlankStringSchema,
  })
  .strict();

export const mutationConfirmationSchema = z.union([
  proposalConfirmationSchema,
  directFactConfirmationSchema,
]);
export type MutationConfirmation = z.infer<typeof mutationConfirmationSchema>;

export const campaignIntentTypeSchema = z.enum([
  "NEW_ITEM",
  "MERCHANT_ITEMS",
  "COMPARE_ITEM",
  "EQUIP_ITEM",
  "SELL_ITEM",
  "LEVEL_UP",
  "RESPEC",
  "SPELL_CHANGE",
  "ILLITHID_POWER",
  "PARTY_STATUS",
  "INVENTORY_QUERY",
  "CHECKPOINT",
  "UNDO",
  "GENERAL_BG3_QUESTION",
  "UNKNOWN",
]);

export const mutationSemanticsSchema = z.enum([
  "READ_ONLY",
  "PROPOSAL",
  "DIRECT_FACT",
  "CONFIRMATION",
  "UNKNOWN",
]);

export const campaignIntentSchema = z
  .object({
    type: campaignIntentTypeSchema,
    confidence: z.number().min(0).max(1),
    mutation_semantics: mutationSemanticsSchema,
    entities: jsonObjectSchema.optional(),
  })
  .strict();
export type CampaignIntent = z.infer<typeof campaignIntentSchema>;

export const itemResolutionCandidateSchema = z
  .object({
    item_definition_id: z.string(),
    name_pl: z.string(),
    name_en: z.string().optional(),
    rarity_pl: z.string().optional(),
    confidence: z.number().min(0).max(1),
    matched_by: z.array(z.string()),
  })
  .strict();

export const itemResolutionResultSchema = z
  .object({
    status: z.enum(["EXACT", "RESOLVED", "AMBIGUOUS", "NOT_FOUND", "CONFLICT"]),
    candidates: z.array(itemResolutionCandidateSchema),
    requires_user_confirmation: z.boolean(),
    conflict_summary_pl: z.string().optional(),
  })
  .strict();
export type ItemResolutionResult = z.infer<typeof itemResolutionResultSchema>;

export const proposalStatusSchema = z.enum(["OPEN", "CONFIRMED", "REJECTED", "EXPIRED"]);

export const proposalSchema = z
  .object({
    id: z.string(),
    intent_type: z.string(),
    human_summary_pl: z.string(),
    payload: jsonObjectSchema,
    status: proposalStatusSchema,
    created_at: z.iso.datetime({ offset: true }),
    expires_at: z.iso.datetime({ offset: true }),
  })
  .strict();
export type Proposal = z.infer<typeof proposalSchema>;

export const toolErrorSchema = z
  .object({
    code: z.string(),
    message_pl: z.string(),
    details: jsonValueSchema.optional(),
  })
  .strict();

export const toolSuccessResultSchema = z
  .object({
    ok: z.literal(true),
    data: jsonValueSchema,
    warnings: z.array(z.string()),
  })
  .strict();

export const toolFailureResultSchema = z
  .object({
    ok: z.literal(false),
    error: toolErrorSchema,
    warnings: z.array(z.string()),
  })
  .strict();

export const toolResultSchema = z.discriminatedUnion("ok", [
  toolSuccessResultSchema,
  toolFailureResultSchema,
]);
export type ToolSuccessResult<T extends JsonValue = JsonValue> = {
  readonly ok: true;
  readonly data: T;
  readonly warnings: readonly string[];
};
export type ToolFailureResult = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message_pl: string;
    readonly details?: JsonValue;
  };
  readonly warnings: readonly string[];
};
export type ToolResult<T extends JsonValue = JsonValue> = ToolSuccessResult<T> | ToolFailureResult;
