import { readMigrationFiles } from "drizzle-orm/migrator";

import type { SqliteDatabase } from "./connection.js";
import { SQLITE_MEMORY_FILENAME } from "./connection.js";
import { DEFAULT_MIGRATIONS_FOLDER } from "./migrations.js";
import { openMigratedSqliteConnection } from "./migrations.js";

export type SchemaCompatibilityErrorCode =
  | "MIGRATION_LEDGER_MISSING"
  | "SCHEMA_OLDER"
  | "SCHEMA_NEWER"
  | "MIGRATION_HISTORY_MISMATCH"
  | "SCHEMA_OBJECT_MISSING"
  | "SCHEMA_STRUCTURE_MISMATCH";

export class SchemaCompatibilityError extends Error {
  public override readonly name = "SchemaCompatibilityError";

  public constructor(
    public readonly code: SchemaCompatibilityErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SchemaCompatibilityOptions {
  readonly migrationsFolder?: string;
}

interface AppliedMigration {
  readonly hash: string;
  readonly createdAt: number;
}

interface SchemaObject {
  readonly type: string;
  readonly name: string;
  readonly tableName: string;
  readonly sql: string | null;
}

const REQUIRED_TABLES = [
  "abilities",
  "change_events",
  "character_abilities",
  "character_attributes",
  "character_illithid_powers",
  "character_spells",
  "characters",
  "checkpoints",
  "equipment",
  "illithid_power_prerequisites",
  "illithid_powers",
  "inventory_items",
  "item_definitions",
  "item_effects",
  "permanent_modifiers",
  "spells",
] as const;

export function assertLatestCampaignSchema(
  database: SqliteDatabase,
  options: SchemaCompatibilityOptions = {},
): void {
  const client = database.$client;
  const ledger = client
    .prepare(
      "select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'",
    )
    .get();
  if (ledger === undefined) {
    throw new SchemaCompatibilityError(
      "MIGRATION_LEDGER_MISSING",
      "Baza nie zawiera historii migracji kampanii.",
    );
  }

  const migrationsFolder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER;
  const expected = readMigrationFiles({
    migrationsFolder,
  }).map((migration) => ({ hash: migration.hash, createdAt: migration.folderMillis }));
  const applied = client
    .prepare(
      "select hash, created_at as createdAt from __drizzle_migrations order by created_at asc, id asc",
    )
    .all() as AppliedMigration[];

  const sharedLength = Math.min(expected.length, applied.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const actual = applied[index]!;
    const required = expected[index]!;
    if (actual.hash !== required.hash || Number(actual.createdAt) !== required.createdAt) {
      throw new SchemaCompatibilityError(
        "MIGRATION_HISTORY_MISMATCH",
        "Historia migracji bazy nie zgadza się z wersją aplikacji.",
      );
    }
  }
  if (applied.length < expected.length) {
    throw new SchemaCompatibilityError(
      "SCHEMA_OLDER",
      "Baza wymaga jawnej aktualizacji schematu przed użyciem CLI.",
    );
  }
  if (applied.length > expected.length) {
    throw new SchemaCompatibilityError(
      "SCHEMA_NEWER",
      "Baza używa nowszego schematu niż ta wersja CLI.",
    );
  }

  const tables = new Set(
    (
      client.prepare("select name from sqlite_master where type = 'table'").all() as {
        readonly name: string;
      }[]
    ).map((row) => row.name),
  );
  const missing = REQUIRED_TABLES.find((name) => !tables.has(name));
  if (missing !== undefined) {
    throw new SchemaCompatibilityError(
      "SCHEMA_OBJECT_MISSING",
      `Baza nie zawiera wymaganego obiektu schematu: ${missing}.`,
    );
  }

  const expectedManifest = expectedSchemaManifest(migrationsFolder);
  const actualManifest = schemaManifest(database);
  if (JSON.stringify(actualManifest) !== JSON.stringify(expectedManifest)) {
    throw new SchemaCompatibilityError(
      "SCHEMA_STRUCTURE_MISMATCH",
      "Struktura bazy nie zgadza się z zatwierdzonym schematem aplikacji.",
    );
  }
}

function expectedSchemaManifest(migrationsFolder: string): readonly SchemaObject[] {
  const connection = openMigratedSqliteConnection({
    filename: SQLITE_MEMORY_FILENAME,
    migrationsFolder,
  });
  try {
    return schemaManifest(connection.database);
  } finally {
    connection.close();
  }
}

function schemaManifest(database: SqliteDatabase): readonly SchemaObject[] {
  return database.$client
    .prepare(
      `select type, name, tbl_name as tableName, sql
       from sqlite_schema
       where name not like 'sqlite_%'
       order by type asc, name asc`,
    )
    .all() as SchemaObject[];
}
