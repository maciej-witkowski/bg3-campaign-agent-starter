import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export const SQLITE_MEMORY_FILENAME = ":memory:";
export const SQLITE_BUSY_TIMEOUT_MS = 5_000;

export type SqliteDatabase = ReturnType<typeof drizzle>;

export interface SqliteConnection {
  readonly database: SqliteDatabase;
  readonly filename: string;
  readonly isMemory: boolean;
  close(): void;
}

function assertExplicitFilename(filename: string): void {
  if (filename.trim().length === 0) {
    throw new TypeError(
      `A SQLite filename or the explicit ${SQLITE_MEMORY_FILENAME} sentinel is required.`,
    );
  }
}

export function openSqliteConnection(filename: string): SqliteConnection {
  assertExplicitFilename(filename);

  const isMemory = filename === SQLITE_MEMORY_FILENAME;
  const client = new Database(filename);

  try {
    client.pragma("foreign_keys = ON");
    client.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);

    if (!isMemory) {
      client.pragma("journal_mode = WAL");
      client.pragma("synchronous = FULL");
    }

    const database = drizzle(client);
    let closed = false;

    return {
      database,
      filename,
      isMemory,
      close(): void {
        if (!closed) {
          client.close();
          closed = true;
        }
      },
    };
  } catch (error: unknown) {
    client.close();
    throw error;
  }
}
