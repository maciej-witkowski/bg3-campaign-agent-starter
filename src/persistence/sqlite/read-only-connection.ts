import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { SQLITE_BUSY_TIMEOUT_MS, SQLITE_MEMORY_FILENAME } from "./connection.js";
import type { SqliteDatabase } from "./connection.js";

export type ReadOnlySqliteConnectionErrorCode = "INVALID_PATH" | "DATABASE_OPEN_FAILED";

export class ReadOnlySqliteConnectionError extends Error {
  public override readonly name = "ReadOnlySqliteConnectionError";

  public constructor(
    public readonly code: ReadOnlySqliteConnectionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ReadOnlySqliteConnection {
  readonly database: SqliteDatabase;
  readonly filename: string;
  close(): void;
}

export function openReadOnlySqliteConnection(filename: string): ReadOnlySqliteConnection {
  if (filename.trim() === "" || filename === SQLITE_MEMORY_FILENAME) {
    throw new ReadOnlySqliteConnectionError(
      "INVALID_PATH",
      "Wymagana jest ścieżka istniejącej plikowej bazy kampanii.",
    );
  }

  let client: Database.Database;
  try {
    client = new Database(filename, { readonly: true, fileMustExist: true });
  } catch {
    throw new ReadOnlySqliteConnectionError(
      "DATABASE_OPEN_FAILED",
      "Nie udało się otworzyć istniejącej bazy kampanii w trybie tylko do odczytu.",
    );
  }

  try {
    client.pragma("query_only = ON");
    client.pragma("foreign_keys = ON");
    client.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    const database = drizzle(client);
    let closed = false;
    return {
      database,
      filename,
      close(): void {
        if (!closed) {
          client.close();
          closed = true;
        }
      },
    };
  } catch {
    client.close();
    throw new ReadOnlySqliteConnectionError(
      "DATABASE_OPEN_FAILED",
      "Nie udało się skonfigurować bezpiecznego odczytu bazy kampanii.",
    );
  }
}
