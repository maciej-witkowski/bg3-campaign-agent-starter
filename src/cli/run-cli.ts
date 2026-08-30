import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CampaignExportWorkbookError } from "../adapters/xlsx/campaign-export-workbook.js";
import { ArtifactWriteError } from "../application/export/atomic-artifact-writer.js";
import { CampaignExportError } from "../application/export/campaign-export.js";
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
import { parseCliArguments } from "./parse-cli-arguments.js";

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
  const json = args.includes("--json");
  const commandHint = inferCommand(args);
  let request: ReturnType<typeof parseCliArguments>;
  try {
    request = parseCliArguments(args);
  } catch (error: unknown) {
    return failureResult(error, json, commandHint);
  }

  if (request.kind === "help") return { exitCode: 0, stdout: HELP, stderr: "" };
  if (request.kind === "version") {
    return { exitCode: 0, stdout: `${options.version ?? packageVersion()}\n`, stderr: "" };
  }

  let application: M3CampaignApplication | undefined;
  try {
    application = (
      options.openApplication ?? ((filename) => openM3CampaignApplication({ filename }))
    )(request.databasePath);
    const executed = await execute(application, request.command);
    const stdout = request.json
      ? serializeCliEnvelope(cliSuccess(request.command.name, executed.data))
      : renderHumanSuccess(request.command.name, executed.data);
    return { exitCode: executed.exitCode, stdout, stderr: "" };
  } catch (error: unknown) {
    return failureResult(error, request.json, request.command.name);
  } finally {
    application?.close();
  }
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
  const exported =
    command.artifactFormat === "json"
      ? await application.campaignExport.writeJson(command.outputPath, {
          overwrite: command.overwrite,
        })
      : await application.campaignExport.writeXlsx(command.outputPath, {
          overwrite: command.overwrite,
        });
  return success({
    artifactFormat: command.artifactFormat,
    outputPath: resolve(command.outputPath),
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

function inferCommand(args: readonly string[]): CliCommandName | null {
  const names: readonly CliCommandName[] = [
    "party",
    "character",
    "equipment",
    "inventory",
    "spells",
    "illithid",
    "changes",
    "validate",
    "export",
  ];
  return names.find((name) => args.includes(name)) ?? null;
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
