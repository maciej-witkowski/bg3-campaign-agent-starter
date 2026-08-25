import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface MigrationFixtureEntry {
  readonly sql: string;
  readonly tag: string;
  readonly when: number;
}

export function writeMigrationFixture(
  migrationsFolder: string,
  entries: readonly MigrationFixtureEntry[],
): void {
  const metadataFolder = join(migrationsFolder, "meta");
  mkdirSync(metadataFolder, { recursive: true });

  const journal = {
    version: "7",
    dialect: "sqlite",
    entries: entries.map((entry, index) => ({
      idx: index,
      version: "6",
      when: entry.when,
      tag: entry.tag,
      breakpoints: true,
    })),
  };

  writeFileSync(
    join(metadataFolder, "_journal.json"),
    `${JSON.stringify(journal, undefined, 2)}\n`,
    "utf8",
  );

  for (const entry of entries) {
    writeFileSync(join(migrationsFolder, `${entry.tag}.sql`), entry.sql, "utf8");
  }
}
