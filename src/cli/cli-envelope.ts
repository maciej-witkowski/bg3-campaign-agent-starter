import {
  CLI_RESULT_FORMAT,
  CLI_RESULT_VERSION,
  type CliCommandName,
  type CliEnvelope,
  type CliErrorPayload,
  type CliFailureEnvelope,
  type CliSuccessEnvelope,
} from "./cli-contract.js";

export function cliSuccess(
  command: CliCommandName,
  data: unknown,
  warnings: readonly string[] = [],
): CliSuccessEnvelope {
  return {
    format: CLI_RESULT_FORMAT,
    version: CLI_RESULT_VERSION,
    command,
    ok: true,
    data,
    warnings,
  };
}

export function cliFailure(
  command: CliCommandName | null,
  error: CliErrorPayload,
  warnings: readonly string[] = [],
): CliFailureEnvelope {
  return {
    format: CLI_RESULT_FORMAT,
    version: CLI_RESULT_VERSION,
    command,
    ok: false,
    error,
    warnings,
  };
}

export function serializeCliEnvelope(envelope: CliEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
