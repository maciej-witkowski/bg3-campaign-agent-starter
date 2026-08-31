import { readFileSync } from "node:fs";
import { CampaignExportWorkbookError } from "../adapters/xlsx/campaign-export-workbook.js";
import {
  ArtifactWriteError,
  resolveArtifactTarget,
} from "../application/export/atomic-artifact-writer.js";
import { CampaignExportError } from "../application/export/campaign-export.js";
import { assertSafeCampaignExportTarget } from "../application/export/campaign-export-target.js";
import { CampaignInspectionError } from "../application/inspection/campaign-inspection.js";
import type { M3CampaignApplication } from "../composition/m3-campaign-application.js";
import { openM3CampaignApplication } from "../composition/m3-campaign-application.js";
import { CampaignValidationError } from "../domain/validation/campaign-validation.js";
import { ReadOnlySqliteConnectionError } from "../persistence/sqlite/read-only-connection.js";
import { SchemaCompatibilityError } from "../persistence/sqlite/schema-compatibility.js";
import { cliFailure, cliSuccess, serializeCliEnvelope } from "./cli-envelope.js";
import {
  CliUsageError,
  type CliCommand,
  type CliCommandName,
  type CliErrorPayload,
  type CliProcessResult,
} from "./cli-contract.js";
import { renderHumanFailure, renderHumanSuccess } from "./human-renderer.js";
import { inspectCliArgumentContext, parseCliArguments } from "./parse-cli-arguments.js";

const HELP = `BG3 Campaign Agent — read-only CLI

Użycie:
  bg3-campaign --db <path> [--json] party
  bg3-campaign --db <path> [--json] character <name>
  bg3-campaign --db <path> [--json] equipment <name>
  bg3-campaign --db <path> [--json] inventory [--slot <slot>]... [--status <status>]... [--tag <tag>]...
  bg3-campaign --db <path> [--json] spells <name>
  bg3-campaign --db <path> [--json] illithid [name]
  bg3-campaign --db <path> [--json] changes [--limit <1-1000>]
  bg3-campaign --db <path> [--json] validate
  bg3-campaign --db <path> [--json] export --format <json|xlsx> --output <path> [--overwrite]

Opcje:
  --db <path>   Istniejąca baza SQLite kampanii (wymagana dla komend danych)
  --json        Wersjonowany wynik BG3_CLI_RESULT V1 na stdout
  -h, --help    Pomoc
  -v, --version Wersja pakietu
`;

export interface RunCliOptions {
  readonly openApplication?: (filename: string) => M3CampaignApplication;
  readonly version?: string;
}

export async function runCli(
  args: readonly string[],
  options: RunCliOptions = {},
): Promise<CliProcessResult> {
  const context = inspectCliArgumentContext(args);
  let request: ReturnType<typeof parseCliArguments>;
  try {
    request = parseCliArguments(args);
  } catch (error: unknown) {
    return failureResult(error, context.json, context.command);
  }

  if (request.kind === "help") return { exitCode: 0, stdout: HELP, stderr: "" };
  if (request.kind === "version") {
    return { exitCode: 0, stdout: `${options.version ?? packageVersion()}\n`, stderr: "" };
  }

  let application: M3CampaignApplication | undefined;
  let commandFailed = false;
  let result: CliProcessResult;
  try {
    if (request.command.name === "export") {
      assertSafeCampaignExportTarget(request.databasePath, request.command.outputPath);
    }
    application = (
      options.openApplication ?? ((filename) => openM3CampaignApplication({ filename }))
    )(request.databasePath);
    const executed = await execute(application, request.command);
    const stdout = request.json
      ? serializeCliEnvelope(cliSuccess(request.command.name, executed.data))
      : renderHumanSuccess(request.command.name, executed.data);
    result = { exitCode: executed.exitCode, stdout, stderr: "" };
  } catch (error: unknown) {
    commandFailed = true;
    result = failureResult(error, request.json, request.command.name);
  }
  if (application !== undefined) {
    try {
      application.close();
    } catch (error: unknown) {
      if (!commandFailed) result = failureResult(error, request.json, request.command.name);
    }
  }
  return result;
}

async function execute(
  application: M3CampaignApplication,
  command: CliCommand,
): Promise<{ readonly data: unknown; readonly exitCode: number }> {
  if (command.name === "party") return success(application.inspection.getParty());
  if (command.name === "character")
    return success(application.inspection.getCharacter(command.characterName));
  if (command.name === "equipment")
    return success(application.inspection.getEquipment(command.characterName));
  if (command.name === "inventory")
    return success(
      application.inspection.findInventory({
        slots: command.slots,
        statuses: command.statuses,
        tags: command.tags,
      }),
    );
  if (command.name === "spells")
    return success(application.inspection.getSpells(command.characterName));
  if (command.name === "illithid")
    return success(application.inspection.getIllithid(command.characterName));
  if (command.name === "changes") return success(application.inspection.getChanges(command.limit));
  if (command.name === "validate") {
    const data = application.validation.validate();
    return { data, exitCode: data.valid ? 0 : 4 };
  }
  const outputPath = resolveArtifactTarget(command.outputPath);
  const exported =
    command.artifactFormat === "json"
      ? await application.campaignExport.writeJson(outputPath, {
          overwrite: command.overwrite,
        })
      : await application.campaignExport.writeXlsx(outputPath, {
          overwrite: command.overwrite,
        });
  return success({
    artifactFormat: command.artifactFormat,
    outputPath,
    exportFormat: exported.format,
    exportVersion: exported.version,
    schemaVersion: exported.schemaVersion,
    exportedAt: exported.exportedAt,
    stateSha256: exported.stateSha256,
  });
}

function success(data: unknown): { readonly data: unknown; readonly exitCode: 0 } {
  return { data, exitCode: 0 };
}

function failureResult(
  error: unknown,
  json: boolean,
  command: CliCommandName | null,
): CliProcessResult {
  const mapped = mapError(error);
  if (json) {
    return {
      exitCode: mapped.exitCode,
      stdout: serializeCliEnvelope(cliFailure(command, mapped.error)),
      stderr: "",
    };
  }
  return {
    exitCode: mapped.exitCode,
    stdout: "",
    stderr: renderHumanFailure(mapped.error.messagePl),
  };
}

function mapError(error: unknown): { readonly error: CliErrorPayload; readonly exitCode: number } {
  if (error instanceof CliUsageError) return mapped(error.code, error.message, error.details, 2);
  if (error instanceof CampaignInspectionError) {
    const exitCode =
      error.code === "CHARACTER_NOT_FOUND" || error.code === "CHARACTER_AMBIGUOUS"
        ? 3
        : error.code === "INVALID_FILTER" || error.code === "INVALID_LIMIT"
          ? 2
          : 4;
    return mapped(error.code, error.message, error.details, exitCode);
  }
  if (error instanceof ReadOnlySqliteConnectionError || error instanceof SchemaCompatibilityError)
    return mapped(error.code, error.message, {}, 4);
  if (error instanceof CampaignValidationError)
    return mapped("CAMPAIGN_INVALID", error.message, { violations: error.violations }, 4);
  if (error instanceof ArtifactWriteError)
    return mapped("ARTIFACT_WRITE_FAILED", error.message, {}, 5);
  if (error instanceof CampaignExportError) return mapped(error.code, error.message, {}, 5);
  if (error instanceof CampaignExportWorkbookError)
    return mapped("XLSX_EXPORT_FAILED", error.message, {}, 5);
  if (error instanceof Error && error.name === "SqliteError")
    return mapped("DATABASE_READ_FAILED", "Nie udało się odczytać bazy kampanii.", {}, 4);
  return mapped("INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd CLI.", {}, 1);
}

function mapped(
  code: string,
  messagePl: string,
  details: Readonly<Record<string, unknown>>,
  exitCode: number,
): { readonly error: CliErrorPayload; readonly exitCode: number } {
  return { error: { code, messagePl, details }, exitCode };
}

function packageVersion(): string {
  try {
    const value = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { readonly version?: unknown };
    return typeof value.version === "string" ? value.version : "unknown";
  } catch {
    return "unknown";
  }
}
