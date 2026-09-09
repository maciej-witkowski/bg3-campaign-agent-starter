import type { z } from "zod";

import type { JsonValue, ToolResult } from "../contracts/domain-contracts.js";
import { ExpectedToolError, type ToolErrorMapper } from "./tool-errors.js";
import { toolFailure, toolSuccess } from "./tool-result.js";

export type ToolExecutionStage = "input" | "precondition" | "handler" | "output" | "envelope";

export interface ToolExecutionObservation {
  readonly toolName: string;
  readonly stage: ToolExecutionStage;
  readonly code: string;
  readonly unexpected: boolean;
}

export type ToolExecutionObserver = (observation: ToolExecutionObservation) => void | Promise<void>;

export interface ExecutableToolDefinition {
  readonly name: string;
  readonly inputSchema: z.ZodType;
  readonly outputSchema: z.ZodType;
}

export interface ToolBeforeInvokeContext<Input> {
  readonly definition: ExecutableToolDefinition;
  readonly input: Input;
}

export interface ExecuteToolOptions<Input, Output extends JsonValue> {
  readonly definition: ExecutableToolDefinition;
  readonly input: unknown;
  readonly handler: (input: Input) => Output | Promise<Output>;
  readonly beforeInvoke?: (context: ToolBeforeInvokeContext<Input>) => void | Promise<void>;
  readonly mapError?: ToolErrorMapper;
  readonly observer?: ToolExecutionObserver;
}

export async function executeTool<Input, Output extends JsonValue>(
  options: ExecuteToolOptions<Input, Output>,
): Promise<ToolResult<Output>> {
  let parsedInput;
  try {
    parsedInput = options.definition.inputSchema.safeParse(options.input);
  } catch {
    await observe(options, "input", "INTERNAL_ERROR", true);
    return toolFailure("INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd narzędzia.");
  }
  if (!parsedInput.success) {
    await observe(options, "input", "INVALID_TOOL_INPUT", false);
    return toolFailure("INVALID_TOOL_INPUT", "Nieprawidłowe argumenty narzędzia.", {
      details: {
        issues: parsedInput.error.issues.slice(0, 8).map((issue) => ({
          code: issue.code,
          path: issue.path.slice(0, 8).map(String),
        })),
      },
    });
  }

  try {
    await options.beforeInvoke?.({
      definition: options.definition,
      input: parsedInput.data as Input,
    });
  } catch (error: unknown) {
    return mappedFailure(options, error, "precondition");
  }

  let rawOutput: unknown;
  try {
    rawOutput = await options.handler(parsedInput.data as Input);
  } catch (error: unknown) {
    return mappedFailure(options, error, "handler");
  }

  let parsedOutput;
  try {
    parsedOutput = options.definition.outputSchema.safeParse(rawOutput);
  } catch {
    await observe(options, "output", "INTERNAL_ERROR", true);
    return toolFailure("INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd narzędzia.");
  }
  if (!parsedOutput.success) {
    await observe(options, "output", "TOOL_OUTPUT_INVALID", false);
    return toolFailure("TOOL_OUTPUT_INVALID", "Narzędzie zwróciło nieprawidłowy wynik.", {
      details: { tool_name: options.definition.name },
    });
  }

  try {
    return toolSuccess(parsedOutput.data as Output);
  } catch {
    await observe(options, "envelope", "TOOL_OUTPUT_INVALID", false);
    return toolFailure("TOOL_OUTPUT_INVALID", "Narzędzie zwróciło wynik niezgodny z JSON.", {
      details: { tool_name: options.definition.name },
    });
  }
}

async function mappedFailure<Input, Output extends JsonValue>(
  options: ExecuteToolOptions<Input, Output>,
  error: unknown,
  stage: ToolExecutionStage,
): Promise<ToolResult<never>> {
  let mapped;
  try {
    mapped =
      error instanceof ExpectedToolError
        ? error.toolError
        : (options.mapError?.(error) ?? undefined);
  } catch {
    await observe(options, stage, "INTERNAL_ERROR", true);
    return toolFailure("INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd narzędzia.");
  }
  if (mapped !== undefined) {
    await observe(options, stage, mapped.code, false);
    return toolFailure(mapped.code, mapped.message_pl, {
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
  await observe(options, stage, "INTERNAL_ERROR", true);
  return toolFailure("INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd narzędzia.");
}

async function observe<Input, Output extends JsonValue>(
  options: ExecuteToolOptions<Input, Output>,
  stage: ToolExecutionStage,
  code: string,
  unexpected: boolean,
): Promise<void> {
  try {
    await options.observer?.({ toolName: options.definition.name, stage, code, unexpected });
  } catch {
    // Diagnostics are best-effort and must never affect the public tool result.
  }
}
