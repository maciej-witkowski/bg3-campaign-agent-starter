import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  openSqliteConnection,
  SQLITE_BUSY_TIMEOUT_MS,
  SQLITE_MEMORY_FILENAME,
} from "../../../src/persistence/sqlite/connection.js";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-sqlite-connection-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("openSqliteConnection", () => {
  it("requires an explicit filename", () => {
    expect(() => openSqliteConnection("   ")).toThrowError(
      "A SQLite filename or the explicit :memory: sentinel is required.",
    );
  });

  it("configures every in-memory connection without creating files", () => {
    const directory = createTemporaryDirectory();
    const unexpectedFile = join(directory, "memory.db");
    const connection = openSqliteConnection(SQLITE_MEMORY_FILENAME);

    try {
      const client = connection.database.$client;

      expect(connection.isMemory).toBe(true);
      expect(client.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(client.pragma("busy_timeout", { simple: true })).toBe(SQLITE_BUSY_TIMEOUT_MS);
      expect(client.pragma("journal_mode", { simple: true })).not.toBe("wal");
      expect(existsSync(unexpectedFile)).toBe(false);
    } finally {
      connection.close();
    }
  });

  it("enables WAL and full durability for file-backed connections", () => {
    const directory = createTemporaryDirectory();
    const filename = join(directory, "campaign.sqlite");
    const connection = openSqliteConnection(filename);

    try {
      const client = connection.database.$client;

      expect(connection.isMemory).toBe(false);
      expect(client.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(client.pragma("busy_timeout", { simple: true })).toBe(SQLITE_BUSY_TIMEOUT_MS);
      expect(client.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(client.pragma("synchronous", { simple: true })).toBe(2);
      expect(existsSync(filename)).toBe(true);
    } finally {
      connection.close();
    }
  });

  it("provides an idempotent explicit close operation", () => {
    const connection = openSqliteConnection(SQLITE_MEMORY_FILENAME);
    const client = connection.database.$client;

    connection.close();
    connection.close();

    expect(() => client.prepare("select 1").get()).toThrowError(
      "The database connection is not open",
    );
  });
});
