import type { JsonValue } from "../contracts/domain-contracts.js";

export const SHARED_TOOL_ERROR_CODES = [
  "INVALID_TOOL_INPUT",
  "NOT_FOUND",
  "AMBIGUOUS",
  "CONFLICT",
  "CAMPAIGN_INVALID",
  "CONFIRMATION_REQUIRED",
  "CONFIRMATION_INVALID",
  "TOOL_NOT_FOUND",
  "TOOL_OUTPUT_INVALID",
  "INTERNAL_ERROR",
] as const;

export type SharedToolErrorCode = (typeof SHARED_TOOL_ERROR_CODES)[number];

export interface SafeToolError {
  readonly code: SharedToolErrorCode;
  readonly message_pl: string;
  readonly details?: JsonValue;
}

export class ExpectedToolError extends Error {
  public override readonly name = "ExpectedToolError";

  public constructor(public readonly toolError: SafeToolError) {
    super(toolError.message_pl);
  }
}

export type ToolErrorMapper = (error: unknown) => SafeToolError | undefined;
