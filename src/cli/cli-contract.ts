import type { InventoryStatus, ItemSlot } from "../domain/model/campaign.js";

export const CLI_RESULT_FORMAT = "BG3_CLI_RESULT" as const;
export const CLI_RESULT_VERSION = 1 as const;

export type CliCommandName =
  | "party"
  | "character"
  | "equipment"
  | "inventory"
  | "spells"
  | "illithid"
  | "changes"
  | "validate"
  | "export";

export type CliCommand =
  | { readonly name: "party" }
  | { readonly name: "character"; readonly characterName: string }
  | { readonly name: "equipment"; readonly characterName: string }
  | {
      readonly name: "inventory";
      readonly slots: readonly ItemSlot[];
      readonly statuses: readonly InventoryStatus[];
      readonly tags: readonly string[];
    }
  | { readonly name: "spells"; readonly characterName: string }
  | { readonly name: "illithid"; readonly characterName?: string }
  | { readonly name: "changes"; readonly limit?: number }
  | { readonly name: "validate" }
  | {
      readonly name: "export";
      readonly artifactFormat: "json" | "xlsx";
      readonly outputPath: string;
      readonly overwrite: boolean;
    };

export interface CliCommandRequest {
  readonly kind: "command";
  readonly databasePath: string;
  readonly json: boolean;
  readonly command: CliCommand;
}

export type CliRequest =
  CliCommandRequest | { readonly kind: "help" } | { readonly kind: "version" };

export interface CliErrorPayload {
  readonly code: string;
  readonly messagePl: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface CliSuccessEnvelope {
  readonly format: typeof CLI_RESULT_FORMAT;
  readonly version: typeof CLI_RESULT_VERSION;
  readonly command: CliCommandName;
  readonly ok: true;
  readonly data: unknown;
  readonly warnings: readonly string[];
}

export interface CliFailureEnvelope {
  readonly format: typeof CLI_RESULT_FORMAT;
  readonly version: typeof CLI_RESULT_VERSION;
  readonly command: CliCommandName | null;
  readonly ok: false;
  readonly error: CliErrorPayload;
  readonly warnings: readonly string[];
}

export type CliEnvelope = CliSuccessEnvelope | CliFailureEnvelope;

export type CliUsageErrorCode = "INVALID_ARGUMENTS" | "UNKNOWN_COMMAND";

export class CliUsageError extends Error {
  public override readonly name = "CliUsageError";

  public constructor(
    public readonly code: CliUsageErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

export interface CliProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
