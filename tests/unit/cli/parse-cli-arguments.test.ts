import { describe, expect, it } from "vitest";

import { CliUsageError } from "../../../src/cli/cli-contract.js";
import { parseCliArguments } from "../../../src/cli/parse-cli-arguments.js";

const invalidInvocations: readonly (readonly string[])[] = [
  [],
  ["party"],
  ["--db", "campaign.sqlite", "unknown"],
  ["--db", "campaign.sqlite", "party", "extra"],
  ["--db", "a.sqlite", "--db", "b.sqlite", "party"],
  ["--db", "campaign.sqlite", "party", "--limit", "1"],
  ["--db", "campaign.sqlite", "changes", "--limit", "0"],
  ["--db", "campaign.sqlite", "changes", "--limit", "1001"],
  ["--db", "campaign.sqlite", "inventory", "--slot", "INVALID"],
  ["--db", "campaign.sqlite", "inventory", "--status", "INVALID"],
  ["--db", "campaign.sqlite", "inventory", "--tag", "   "],
  ["--db", "campaign.sqlite", "export", "--format", "xml", "--output", "x"],
  ["--db", "campaign.sqlite", "export", "--format", "json"],
  ["--db", "campaign.sqlite", "party", "--unknown"],
];

describe("parseCliArguments", () => {
  it.each([
    [["--db", "campaign.sqlite", "party"], { name: "party" }],
    [
      ["character", "Lae'zel", "--db", "campaign.sqlite", "--json"],
      { name: "character", characterName: "Lae'zel" },
    ],
    [
      ["--db", "campaign.sqlite", "equipment", "Gale"],
      { name: "equipment", characterName: "Gale" },
    ],
    [["--db", "campaign.sqlite", "spells", "Gale"], { name: "spells", characterName: "Gale" }],
    [["--db", "campaign.sqlite", "illithid"], { name: "illithid" }],
    [
      ["--db", "campaign.sqlite", "illithid", "Astarion"],
      { name: "illithid", characterName: "Astarion" },
    ],
    [["--db", "campaign.sqlite", "changes", "--limit", "12"], { name: "changes", limit: 12 }],
    [["--db", "campaign.sqlite", "validate"], { name: "validate" }],
    [
      [
        "--db",
        "campaign.sqlite",
        "export",
        "--format",
        "xlsx",
        "--output",
        "state.xlsx",
        "--overwrite",
      ],
      { name: "export", artifactFormat: "xlsx", outputPath: "state.xlsx", overwrite: true },
    ],
  ] as const)("parses a valid command %#", (args, expected) => {
    expect(parseCliArguments(args)).toMatchObject({
      kind: "command",
      databasePath: "campaign.sqlite",
      command: expected,
    });
  });

  it("preserves and deduplicates repeatable inventory filters", () => {
    expect(
      parseCliArguments([
        "--db",
        "campaign.sqlite",
        "inventory",
        "--slot",
        "RING",
        "--slot",
        "BODY",
        "--status",
        "CHEST",
        "--status",
        "CHEST",
        "--tag",
        "aura",
      ]),
    ).toMatchObject({
      command: {
        name: "inventory",
        slots: ["RING", "BODY"],
        statuses: ["CHEST"],
        tags: ["aura"],
      },
    });
  });

  it.each(invalidInvocations.map((args) => [args] as const))(
    "rejects invalid invocation %# before opening a database",
    (args) => {
      expect(() => parseCliArguments(args)).toThrowError(CliUsageError);
    },
  );

  it("handles help and version without a database", () => {
    expect(parseCliArguments(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArguments(["-v"])).toEqual({ kind: "version" });
  });
});
