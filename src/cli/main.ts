#!/usr/bin/env node

import { runCli } from "./run-cli.js";

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const result = await runCli(args);
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

await main();
