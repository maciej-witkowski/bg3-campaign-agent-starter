import { mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  calculateSnapshotSha256,
  serializeCampaignSnapshot,
  verifyCheckpointSnapshot,
} from "../../../src/domain/snapshots/campaign-snapshot.js";
import { openSqliteConnection } from "../../../src/persistence/sqlite/connection.js";
import {
  migrateSqliteConnection,
  openMigratedSqliteConnection,
} from "../../../src/persistence/sqlite/migrations.js";
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
  it("resolves committed migrations independently of the process working directory", () => {
    const directory = createTemporaryDirectory();
    const workingDirectory = createTemporaryDirectory();
    const originalWorkingDirectory = process.cwd();
    let connection: ReturnType<typeof openMigratedSqliteConnection> | undefined;

    try {
      process.chdir(workingDirectory);
      connection = openMigratedSqliteConnection({ filename: join(directory, "campaign.sqlite") });
      expect(
        connection.database.$client
          .prepare("select name from sqlite_master where type = 'table' and name = 'characters'")
          .get(),
      ).toEqual({ name: "characters" });
    } finally {
      connection?.close();
      process.chdir(originalWorkingDirectory);
    }
  });

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

  it.each([1, 2, 3])(
    "upgrades cleanly from committed migration cut point %s",
    (appliedMigrationCount) => {
      const directory = createTemporaryDirectory();
      const migrationsFolder = join(directory, "migrations");
      const filename = join(directory, "campaign.sqlite");
      writeMigrationFixture(migrationsFolder, committedMigrations.slice(0, appliedMigrationCount));
      const connection = openMigratedSqliteConnection({ filename, migrationsFolder });

      try {
        writeMigrationFixture(migrationsFolder, committedMigrations);
        migrateSqliteConnection(connection, migrationsFolder);
        const migrationCount = connection.database.$client
          .prepare("select count(*) as count from __drizzle_migrations")
          .get() as { count: number };
        expect(migrationCount.count).toBe(committedMigrations.length);
        expect(connection.database.$client.pragma("integrity_check")).toEqual([
          { integrity_check: "ok" },
        ]);
        expect(connection.database.$client.pragma("foreign_key_check")).toEqual([]);
      } finally {
        connection.close();
      }
    },
  );

  it("upgrades a 0000+0001 database without losing legacy checkpoint or related state", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");

    writeMigrationFixture(migrationsFolder, committedMigrations.slice(0, 2));
    const connection = openMigratedSqliteConnection({ filename, migrationsFolder });

    try {
      const client = connection.database.$client;
      const instant = "2026-08-26T12:00:00.000Z";
      const payload = '{"legacy":true}';
      const digest = "a".repeat(64);
      client
        .prepare(
          "insert into characters (id, canonical_name, display_name_pl, race_pl, class_pl, subclass_pl, level, role_summary, active_party, notes, created_at, updated_at) values (?, ?, ?, null, ?, null, 1, ?, 1, null, ?, ?)",
        )
        .run("character-1", "astarion", "Astarion", "Łotrzyk", "Wsparcie", instant, instant);
      client
        .prepare(
          "insert into change_events (id, occurred_at, type, character_id, proposal_id, summary_pl, reason_pl, before_json, after_json, reverses_change_event_id) values (?, ?, ?, ?, null, ?, null, '{}', '{}', null)",
        )
        .run("event-1", instant, "LEGACY", "character-1", "Starsze zdarzenie");
      client
        .prepare(
          "insert into checkpoints (id, label, created_at, snapshot_version, snapshot_json, snapshot_sha256, reason_pl, change_event_id) values (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run("checkpoint-legacy", "Przed migracją", instant, 1, payload, digest, "Test", "event-1");

      writeMigrationFixture(migrationsFolder, committedMigrations);
      migrateSqliteConnection(connection, migrationsFolder);

      expect(
        client.prepare("select canonical_name from characters where id = ?").get("character-1"),
      ).toEqual({ canonical_name: "astarion" });
      expect(
        client.prepare("select summary_pl from change_events where id = ?").get("event-1"),
      ).toEqual({ summary_pl: "Starsze zdarzenie" });
      expect(
        client.prepare("select * from checkpoints where id = ?").get("checkpoint-legacy"),
      ).toEqual({
        id: "checkpoint-legacy",
        label: "Przed migracją",
        created_at: instant,
        snapshot_format: "BG3_LEGACY_CHECKPOINT",
        snapshot_version: 1,
        schema_version: 2,
        snapshot_json: payload,
        snapshot_sha256: digest,
        reason_pl: "Test",
        change_event_id: "event-1",
      });
      const legacy = client
        .prepare("select * from checkpoints where id = ?")
        .get("checkpoint-legacy") as Record<string, unknown>;
      expect(() =>
        verifyCheckpointSnapshot({
          snapshotFormat: String(legacy.snapshot_format),
          snapshotVersion: Number(legacy.snapshot_version),
          schemaVersion: Number(legacy.schema_version),
          snapshotJson: String(legacy.snapshot_json),
          snapshotSha256: String(legacy.snapshot_sha256),
        }),
      ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }));
      expect(client.pragma("foreign_key_check")).toEqual([]);
    } finally {
      connection.close();
    }
  });

  it("repairs an already-applied 0002 database without reclassifying valid V1 rows", () => {
    const directory = createTemporaryDirectory();
    const migrationsFolder = join(directory, "migrations");
    const filename = join(directory, "campaign.sqlite");
    writeMigrationFixture(migrationsFolder, committedMigrations.slice(0, 3));
    const connection = openMigratedSqliteConnection({ filename, migrationsFolder });

    try {
      const client = connection.database.$client;
      const instant = "2026-08-26T12:00:00.000Z";
      const legacyPayload = '{"legacy":true}';
      const validPayload = serializeCampaignSnapshot(emptySnapshot(3, instant));
      const insert = client.prepare(
        "insert into checkpoints (id, label, created_at, snapshot_format, snapshot_version, schema_version, snapshot_json, snapshot_sha256, reason_pl, change_event_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, null)",
      );
      insert.run(
        "legacy",
        "Legacy",
        instant,
        "BG3_CAMPAIGN_SNAPSHOT",
        1,
        2,
        legacyPayload,
        calculateSnapshotSha256(legacyPayload),
        "Test",
      );
      insert.run(
        "valid-v1",
        "V1",
        instant,
        "BG3_CAMPAIGN_SNAPSHOT",
        1,
        3,
        validPayload,
        calculateSnapshotSha256(validPayload),
        "Test",
      );

      writeMigrationFixture(migrationsFolder, committedMigrations);
      migrateSqliteConnection(connection, migrationsFolder);

      expect(
        client
          .prepare(
            "select snapshot_format, snapshot_json, snapshot_sha256 from checkpoints where id = 'legacy'",
          )
          .get(),
      ).toEqual({
        snapshot_format: "BG3_LEGACY_CHECKPOINT",
        snapshot_json: legacyPayload,
        snapshot_sha256: calculateSnapshotSha256(legacyPayload),
      });
      expect(
        client.prepare("select snapshot_format from checkpoints where id = 'valid-v1'").get(),
      ).toEqual({ snapshot_format: "BG3_CAMPAIGN_SNAPSHOT" });
      expect(client.pragma("foreign_key_check")).toEqual([]);
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

function emptySnapshot(schemaVersion: number, capturedAt: string) {
  return {
    format: "BG3_CAMPAIGN_SNAPSHOT",
    version: 1,
    schemaVersion,
    capturedAt,
    state: {
      characters: [],
      characterAttributes: [],
      permanentModifiers: [],
      itemDefinitions: [],
      itemEffects: [],
      inventoryItems: [],
      equipment: [],
      spells: [],
      characterSpells: [],
      abilities: [],
      characterAbilities: [],
      illithidPowers: [],
      illithidPowerPrerequisites: [],
      characterIllithidPowers: [],
    },
  } as const;
}
