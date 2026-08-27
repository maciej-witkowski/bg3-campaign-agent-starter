import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { openSqliteConnection, type SqliteConnection } from "./connection.js";

export const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

export interface OpenMigratedSqliteConnectionOptions {
  readonly filename: string;
  readonly migrationsFolder?: string;
}

export function migrateSqliteConnection(
  connection: SqliteConnection,
  migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER,
): void {
  migrate(connection.database, { migrationsFolder });
}

export function openMigratedSqliteConnection(
  options: OpenMigratedSqliteConnectionOptions,
): SqliteConnection {
  const connection = openSqliteConnection(options.filename);

  try {
    migrateSqliteConnection(connection, options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER);
    return connection;
  } catch (error: unknown) {
    connection.close();
    throw error;
  }
}
