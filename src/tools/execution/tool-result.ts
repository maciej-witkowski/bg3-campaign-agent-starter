import type { JsonValue, ToolResult } from "../contracts/domain-contracts.js";
import { toolResultSchema } from "../contracts/domain-contracts.js";
import type { SafeToolError, SharedToolErrorCode } from "./tool-errors.js";

const MAX_MESSAGE_LENGTH = 500;
const MAX_WARNING_LENGTH = 500;
const MAX_WARNINGS = 20;
const MAX_DETAIL_DEPTH = 4;
const MAX_DETAIL_COLLECTION = 20;
const ALLOWED_DETAIL_KEYS = new Set([
  "actual",
  "code",
  "entity_ids",
  "expected",
  "issues",
  "path",
  "reason",
  "tool_name",
]);

export function toolSuccess<T extends JsonValue>(
  data: T,
  warnings: readonly string[] = [],
): ToolResult<T> {
  return toolResultSchema.parse({
    ok: true,
    data,
    warnings: boundWarnings(warnings),
  }) as ToolResult<T>;
}

export function toolFailure(
  code: SharedToolErrorCode,
  messagePl: string,
  options: { readonly details?: JsonValue; readonly warnings?: readonly string[] } = {},
): ToolResult<never> {
  const error: SafeToolError = {
    code,
    message_pl: boundText(messagePl, MAX_MESSAGE_LENGTH),
    ...(options.details === undefined ? {} : { details: boundedDetails(options.details) }),
  };
  return toolResultSchema.parse({
    ok: false,
    error,
    warnings: boundWarnings(options.warnings ?? []),
  }) as ToolResult<never>;
}

function boundWarnings(warnings: readonly string[]): string[] {
  return warnings.slice(0, MAX_WARNINGS).map((warning) => boundText(warning, MAX_WARNING_LENGTH));
}

function boundText(value: string, maximum: number): string {
  return value.length <= maximum ? value : value.slice(0, maximum);
}

function boundedDetails(value: JsonValue): JsonValue {
  return sanitizeDetail(value, 0, new WeakSet<object>());
}

function sanitizeDetail(value: JsonValue, depth: number, seen: WeakSet<object>): JsonValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return boundText(value, MAX_MESSAGE_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= MAX_DETAIL_DEPTH) return null;
  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value))
    return value
      .slice(0, MAX_DETAIL_COLLECTION)
      .map((item) => sanitizeDetail(item, depth + 1, seen));
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_DETAIL_COLLECTION)) {
    if (ALLOWED_DETAIL_KEYS.has(key)) result[key] = sanitizeDetail(item, depth + 1, seen);
  }
  return result;
}
