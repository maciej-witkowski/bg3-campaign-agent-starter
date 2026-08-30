import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openReadOnlySqliteConnection } from "../../../src/persistence/sqlite/read-only-connection.js";
import type { ReadOnlySqliteConnectionError } from "../../../src/persistence/sqlite/read-only-connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bg3-read-only-connection-"));
  temporaryDirectories.push(directory);
  return directory;
}

function sha256(filename: string): string {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("openReadOnlySqliteConnection", () => {
  it.each(["", "   ", ":memory:"])("rejects a non-file path %j", (filename) => {
    expect(() => openReadOnlySqliteConnection(filename)).toThrowError(
      expect.objectContaining<Partial<ReadOnlySqliteConnectionError>>({ code: "INVALID_PATH" }),
    );
  });

  it("does not create a missing database", () => {
    const filename = join(createTemporaryDirectory(), "missing.sqlite");

    expect(() => openReadOnlySqliteConnection(filename)).toThrowError(
      expect.objectContaining<Partial<ReadOnlySqliteConnectionError>>({
        code: "DATABASE_OPEN_FAILED",
      }),
    );
    expect(existsSync(filename)).toBe(false);
  });

  it("enforces query-only access and leaves the database bytes unchanged", () => {
    const filename = join(createTemporaryDirectory(), "campaign.sqlite");
    const writable = openMigratedSqliteConnection({ filename });
    writable.close();
    const before = sha256(filename);
    const connection = openReadOnlySqliteConnection(filename);

    try {
      const client = connection.database.$client;
      expect(client.pragma("query_only", { simple: true })).toBe(1);
      expect(client.prepare("select count(*) as count from characters").get()).toEqual({
        count: 0,
      });
      expect(() =>
        client.prepare("insert into characters (id) values ('blocked')").run(),
      ).toThrow();
    } finally {
      connection.close();
    }

    expect(sha256(filename)).toBe(before);
  });

  it("provides an idempotent close operation", () => {
    const filename = join(createTemporaryDirectory(), "campaign.sqlite");
    const writable = openMigratedSqliteConnection({ filename });
    writable.close();
    const connection = openReadOnlySqliteConnection(filename);
    const client = connection.database.$client;

    connection.close();
    connection.close();

    expect(() => client.prepare("select 1").get()).toThrowError(
      "The database connection is not open",
    );
  });
});
