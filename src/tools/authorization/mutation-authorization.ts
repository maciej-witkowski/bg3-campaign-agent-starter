import { createHash } from "node:crypto";

import type { JsonValue, MutationConfirmation } from "../contracts/domain-contracts.js";
import type { MutationToolName } from "../catalog/mutation-tool-catalog.js";

export type MutationAuthorizationClaim =
  | { readonly mode: "PROPOSAL"; readonly proposalId: string }
  | { readonly mode: "DIRECT_FACT"; readonly sourceUtterance: string };

export interface MutationAuthorizationRequest {
  readonly toolName: MutationToolName;
  readonly payloadDigest: string;
  readonly claim: MutationAuthorizationClaim;
}

export type MutationAuthorizationDecision =
  | { readonly authorized: true; readonly authorizationId: string }
  | {
      readonly authorized: false;
      readonly code: "CONFIRMATION_REQUIRED" | "CONFIRMATION_INVALID";
      readonly reason:
        | "MISSING"
        | "EXPIRED"
        | "REPLAYED"
        | "TOOL_MISMATCH"
        | "PAYLOAD_MISMATCH"
        | "CLAIM_MISMATCH"
        | "AMBIGUOUS";
    };

export interface MutationAuthorizationPort<TContext> {
  authorize(
    context: TContext,
    request: MutationAuthorizationRequest,
  ): MutationAuthorizationDecision | Promise<MutationAuthorizationDecision>;
}

export function mutationAuthorizationClaim(
  confirmation: MutationConfirmation,
): MutationAuthorizationClaim {
  return "proposal_id" in confirmation
    ? Object.freeze({ mode: "PROPOSAL", proposalId: confirmation.proposal_id })
    : Object.freeze({
        mode: "DIRECT_FACT",
        sourceUtterance: confirmation.source_utterance,
      });
}

export function canonicalJsonDigest(value: JsonValue): string {
  const digest = createHash("sha256")
    .update(`bg3-mutation-payload-v1\n${canonicalJson(value)}`, "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const objectValue = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key]!)}`)
    .join(",")}}`;
}
