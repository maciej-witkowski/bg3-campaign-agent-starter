import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openSqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { openReadOnlySqliteConnection } from "../../../src/persistence/sqlite/read-only-connection.js";
import { assertLatestCampaignSchema } from "../../../src/persistence/sqlite/schema-compatibility.js";
import type { SchemaCompatibilityError } from "../../../src/persistence/sqlite/schema-compatibility.js";
import { writeMigrationFixture } from "./migration-fixture.js";

const temporaryDirectories: string[] = [];
const committedMigrations = [
  {
    tag: "0000_chief_cassandra_nova",
    when: 1_787_702_801_605,
    sql: readFileSync(join("drizzle", "0000_chief_cassandra_nova.sql"), "utf8"),
  },
  {
    tag: "0001_change_events_append_only",
    when: 1_787_706_000_000,
    sql: readFileSync(join("drizzle", "0001_change_events_append_only.sql"), "utf8"),
  },
  {
    tag: "0002_wild_warpath",
    when: 1_787_740_085_480,
    sql: readFileSync(join("drizzle", "0002_wild_warpath.sql"), "utf8"),
  },
  {
    tag: "0003_natural_dazzler",
    when: 1_787_864_619_677,
    sql: readFileSync(join("drizzle", "0003_natural_dazzler.sql"), "utf8"),
  },
] as const;

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-schema-compatibility-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("assertLatestCampaignSchema", () => {
  it("accepts the exact committed migration history through a read-only connection", () => {
    const filename = join(createTemporaryDirectory(), "campaign.sqlite");
    const migrated = openMigratedSqliteConnection({ filename });
    migrated.close();
    const readOnly = openReadOnlySqliteConnection(filename);

    try {
      expect(() => assertLatestCampaignSchema(readOnly.database)).not.toThrow();
    } finally {
      readOnly.close();
    }
  });

  it("rejects a database without the migration ledger", () => {
    const filename = join(createTemporaryDirectory(), "empty.sqlite");
    const connection = openSqliteConnection(filename);

    try {
      expect(() => assertLatestCampaignSchema(connection.database)).toThrowError(
        expect.objectContaining<Partial<SchemaCompatibilityError>>({
          code: "MIGRATION_LEDGER_MISSING",
        }),
      );
    } finally {
      connection.close();
    }
  });

  it("rejects an older schema without applying its missing migrations", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "older.sqlite");
    writeMigrationFixture(migrationsFolder, committedMigrations.slice(0, 3));
    const migrated = openMigratedSqliteConnection({ filename, migrationsFolder });
    migrated.close();
    writeMigrationFixture(migrationsFolder, committedMigrations);
    const readOnly = openReadOnlySqliteConnection(filename);

    try {
      expect(() =>
        assertLatestCampaignSchema(readOnly.database, { migrationsFolder }),
      ).toThrowError(
        expect.objectContaining<Partial<SchemaCompatibilityError>>({ code: "SCHEMA_OLDER" }),
      );
      const count = readOnly.database.$client
        .prepare("select count(*) as count from __drizzle_migrations")
        .get() as { count: number };
      expect(count.count).toBe(3);
    } finally {
      readOnly.close();
    }
  });

  it("rejects newer and mismatched migration histories", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");
    writeMigrationFixture(migrationsFolder, committedMigrations);
    const connection = openMigratedSqliteConnection({ filename, migrationsFolder });

    try {
      connection.database.$client.pragma("query_only = OFF");
      connection.database.$client
        .prepare("insert into __drizzle_migrations (hash, created_at) values (?, ?)")
        .run("f".repeat(64), committedMigrations.at(-1)!.when + 1);
      expect(() =>
        assertLatestCampaignSchema(connection.database, { migrationsFolder }),
      ).toThrowError(
        expect.objectContaining<Partial<SchemaCompatibilityError>>({ code: "SCHEMA_NEWER" }),
      );

      connection.database.$client
        .prepare("delete from __drizzle_migrations where hash = ?")
        .run("f".repeat(64));
      connection.database.$client
        .prepare("update __drizzle_migrations set hash = ? where created_at = ?")
        .run("0".repeat(64), committedMigrations[0].when);
      expect(() =>
        assertLatestCampaignSchema(connection.database, { migrationsFolder }),
      ).toThrowError(
        expect.objectContaining<Partial<SchemaCompatibilityError>>({
          code: "MIGRATION_HISTORY_MISMATCH",
        }),
      );
    } finally {
      connection.close();
    }
  });

  it("rejects a missing required schema object even with a matching ledger", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");
    writeMigrationFixture(migrationsFolder, committedMigrations);
    const connection = openMigratedSqliteConnection({ filename, migrationsFolder });

    try {
      connection.database.$client.prepare("drop table abilities").run();
      expect(() =>
        assertLatestCampaignSchema(connection.database, { migrationsFolder }),
      ).toThrowError(
        expect.objectContaining<Partial<SchemaCompatibilityError>>({
          code: "SCHEMA_OBJECT_MISSING",
        }),
      );
    } finally {
      connection.close();
    }
  });
});
