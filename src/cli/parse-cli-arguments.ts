import { parseArgs } from "node:util";

import { INVENTORY_STATUSES, ITEM_SLOTS } from "../domain/model/campaign.js";
import {
  CliUsageError,
  type CliCommand,
  type CliCommandName,
  type CliRequest,
} from "./cli-contract.js";

const commandNames = new Set<CliCommandName>([
  "party",
  "character",
  "equipment",
  "inventory",
  "spells",
  "illithid",
  "changes",
  "validate",
  "export",
]);
const singleValueOptions = ["db", "limit", "format", "output"] as const;
const cliOptions = {
  db: { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
  version: { type: "boolean", short: "v", default: false },
  slot: { type: "string", multiple: true },
  status: { type: "string", multiple: true },
  tag: { type: "string", multiple: true },
  limit: { type: "string" },
  format: { type: "string" },
  output: { type: "string" },
  overwrite: { type: "boolean", default: false },
} as const;

export function parseCliArguments(args: readonly string[]): CliRequest {
  let parsed: ReturnType<typeof parseNativeArguments>;
  try {
    parsed = parseNativeArguments(args);
  } catch (error: unknown) {
    throw usage(error instanceof Error ? error.message : "Niepoprawne argumenty CLI.");
  }

  rejectDuplicateSingleValues(parsed.tokens);
  if (parsed.values.help) return { kind: "help" };
  if (parsed.values.version) return { kind: "version" };

  const [rawCommand, ...positionals] = parsed.positionals;
  if (rawCommand === undefined || !commandNames.has(rawCommand as CliCommandName)) {
    throw new CliUsageError("UNKNOWN_COMMAND", "Nieznana lub brakująca komenda CLI.", {
      command: rawCommand ?? null,
    });
  }
  const databasePath = requiredText(parsed.values.db, "--db");
  const commandName = rawCommand as CliCommandName;
  validateAllowedOptions(commandName, parsed.tokens);
  const command = commandFor(commandName, positionals, parsed.values);
  return {
    kind: "command",
    databasePath,
    json: parsed.values.json ?? false,
    command,
  };
}

export interface CliArgumentContext {
  readonly command: CliCommandName | null;
  readonly json: boolean;
}

export function inspectCliArgumentContext(args: readonly string[]): CliArgumentContext {
  try {
    const parsed = parseLenientArguments(args);
    const rawCommand = parsed.tokens.find((token) => token.kind === "positional")?.value;
    return {
      command:
        rawCommand !== undefined && commandNames.has(rawCommand as CliCommandName)
          ? (rawCommand as CliCommandName)
          : null,
      json: parsed.tokens.some((token) => token.kind === "option" && token.name === "json"),
    };
  } catch {
    return { command: null, json: false };
  }
}

function commandFor(
  name: CliCommandName,
  positionals: readonly string[],
  values: ReturnType<typeof parseNativeArguments>["values"],
): CliCommand {
  if (name === "party" || name === "validate") {
    requirePositionals(positionals, 0, name);
    return { name };
  }
  if (name === "character" || name === "equipment" || name === "spells") {
    requirePositionals(positionals, 1, name);
    return { name, characterName: requiredText(positionals[0], "nazwa postaci") };
  }
  if (name === "illithid") {
    requirePositionals(positionals, positionals.length > 0 ? 1 : 0, name);
    return positionals[0] === undefined
      ? { name }
      : { name, characterName: requiredText(positionals[0], "nazwa postaci") };
  }
  if (name === "inventory") {
    requirePositionals(positionals, 0, name);
    const slots = unique(values.slot ?? []).map((value) => {
      if (!ITEM_SLOTS.includes(value as never)) throw usage(`Niepoprawny --slot: ${value}.`);
      return value as (typeof ITEM_SLOTS)[number];
    });
    const statuses = unique(values.status ?? []).map((value) => {
      if (!INVENTORY_STATUSES.includes(value as never))
        throw usage(`Niepoprawny --status: ${value}.`);
      return value as (typeof INVENTORY_STATUSES)[number];
    });
    const tags = unique(values.tag ?? []).map((value) => requiredText(value, "--tag"));
    return { name, slots, statuses, tags };
  }
  if (name === "changes") {
    requirePositionals(positionals, 0, name);
    if (values.limit === undefined) return { name };
    if (!/^[1-9]\d*$/u.test(values.limit))
      throw usage("--limit musi być dodatnią liczbą całkowitą.");
    const limit = Number(values.limit);
    if (!Number.isSafeInteger(limit) || limit > 1_000)
      throw usage("--limit musi mieścić się w zakresie 1–1000.");
    return { name, limit };
  }
  requirePositionals(positionals, 0, name);
  if (values.format !== "json" && values.format !== "xlsx")
    throw usage("--format musi mieć wartość json albo xlsx.");
  return {
    name,
    artifactFormat: values.format,
    outputPath: requiredText(values.output, "--output"),
    overwrite: values.overwrite ?? false,
  };
}

function validateAllowedOptions(
  command: CliCommandName,
  tokens: ReturnType<typeof parseNativeArguments>["tokens"],
): void {
  const global = new Set(["db", "json", "help", "version"]);
  const commandOptions: Readonly<Record<CliCommandName, ReadonlySet<string>>> = {
    party: new Set(),
    character: new Set(),
    equipment: new Set(),
    inventory: new Set(["slot", "status", "tag"]),
    spells: new Set(),
    illithid: new Set(),
    changes: new Set(["limit"]),
    validate: new Set(),
    export: new Set(["format", "output", "overwrite"]),
  };
  const disallowed = tokens.find(
    (token) =>
      token.kind === "option" &&
      !global.has(token.name) &&
      !commandOptions[command].has(token.name),
  );
  if (disallowed?.kind === "option") {
    throw usage(`Opcja --${disallowed.name} nie jest dozwolona dla komendy ${command}.`);
  }
}

function rejectDuplicateSingleValues(
  tokens: ReturnType<typeof parseNativeArguments>["tokens"],
): void {
  for (const name of singleValueOptions) {
    const count = tokens.filter((token) => token.kind === "option" && token.name === name).length;
    if (count > 1) throw usage(`Opcja --${name} może wystąpić tylko raz.`);
  }
}

function requirePositionals(
  positionals: readonly string[],
  expected: number,
  command: CliCommandName,
): void {
  if (positionals.length !== expected) {
    throw usage(`Komenda ${command} otrzymała niepoprawną liczbę argumentów pozycyjnych.`);
  }
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw usage(`Wymagane: ${label}.`);
  return value.trim();
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function usage(message: string): CliUsageError {
  return new CliUsageError("INVALID_ARGUMENTS", message);
}

function parseNativeArguments(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    tokens: true,
    options: cliOptions,
  });
}

function parseLenientArguments(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: false,
    tokens: true,
    options: cliOptions,
  });
}
