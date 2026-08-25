import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openSqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import {
  migrateSqliteConnection,
  openMigratedSqliteConnection,
} from "../../../src/persistence/sqlite/migrations.js";
import { writeMigrationFixture } from "./migration-fixture.js";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-sqlite-migrations-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite migrations", () => {
  it("applies an empty-to-latest migration and treats a second run as a no-op", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");

    writeMigrationFixture(migrationsFolder, [
      {
        tag: "0000_test_foundation",
        when: 1_000,
        sql: [
          "CREATE TABLE migration_probe (id integer PRIMARY KEY, value text NOT NULL);",
          "--> statement-breakpoint",
          "INSERT INTO migration_probe (id, value) VALUES (1, 'once');",
        ].join("\n"),
      },
    ]);

    const connection = openMigratedSqliteConnection({
      filename,
      migrationsFolder,
    });

    try {
      migrateSqliteConnection(connection, migrationsFolder);

      const probeCount = connection.database.$client
        .prepare("select count(*) as count from migration_probe")
        .get() as { count: number };
      const migrationCount = connection.database.$client
        .prepare("select count(*) as count from __drizzle_migrations")
        .get() as { count: number };

      expect(probeCount.count).toBe(1);
      expect(migrationCount.count).toBe(1);
    } finally {
      connection.close();
    }
  });

  it("rolls back a failed migration and closes the initialization connection", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");
    const movedFilename = join(directory, "after-failure.sqlite");

    writeMigrationFixture(migrationsFolder, [
      {
        tag: "0000_failing_foundation",
        when: 1_000,
        sql: [
          "CREATE TABLE should_rollback (id integer PRIMARY KEY);",
          "--> statement-breakpoint",
          "INSERT INTO table_that_does_not_exist (id) VALUES (1);",
        ].join("\n"),
      },
    ]);

    expect(() => openMigratedSqliteConnection({ filename, migrationsFolder })).toThrow();

    renameSync(filename, movedFilename);

    const inspectionConnection = openSqliteConnection(movedFilename);
    try {
      const rolledBackTable = inspectionConnection.database.$client
        .prepare("select name from sqlite_master where type = 'table' and name = 'should_rollback'")
        .get();
      const migrationRows = inspectionConnection.database.$client
        .prepare("select count(*) as count from __drizzle_migrations")
        .get() as { count: number };

      expect(rolledBackTable).toBeUndefined();
      expect(migrationRows.count).toBe(0);
    } finally {
      inspectionConnection.close();
    }
  });
});
