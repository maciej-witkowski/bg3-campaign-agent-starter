import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Character } from "../../../src/domain/model/campaign.js";
import {
  CampaignDomainError,
  CampaignPersistenceError,
} from "../../../src/domain/mutations/campaign-mutation.js";
import {
  CharacterMutationService,
  CheckpointMutationService,
} from "../../../src/domain/services/m1-mutation-services.js";
import {
  calculateSnapshotSha256,
  deserializeCampaignSnapshot,
  verifyCheckpointSnapshot,
  verifySnapshotSha256,
} from "../../../src/domain/snapshots/campaign-snapshot.js";
import { CampaignMutationCoordinator } from "../../../src/persistence/sqlite/campaign-mutation-coordinator.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { changeEvents, checkpoints } from "../../../src/persistence/sqlite/schema.js";

const now = new Date("2026-08-26T12:00:00.000Z");
const metadata = { type: "CHECKPOINT_CREATED", summaryPl: "Utworzono punkt kontrolny" };
let connection: SqliteConnection;
let eventId = 0;
let checkpointId = 0;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
  eventId = 0;
  checkpointId = 0;
});
afterEach(() => connection.close());

describe("real snapshots and checkpoint mutation", () => {
  it("captures real coordinator before/after state and excludes historical tables", () => {
    const result = new CharacterMutationService(coordinator()).createCharacter(hero("bohater"), {
      type: "CHARACTER_CREATED",
      summaryPl: "Dodano bohatera",
    });
    expect(result.changed).toBe(true);
    const event = connection.database.select().from(changeEvents).get();
    const before = deserializeCampaignSnapshot(event!.beforeJson);
    const after = deserializeCampaignSnapshot(event!.afterJson);
    expect(before.state.characters).toEqual([]);
    expect(after.state.characters).toHaveLength(1);
    expect(Object.keys(after.state)).not.toContain("changeEvents");
    expect(Object.keys(after.state)).not.toContain("checkpoints");
    expect(after.capturedAt).toBe(now.toISOString());
    expect(event?.checkpointId).toBeNull();
  });

  it("persists checkpoint payload, digest and exactly one audit atomically", () => {
    const result = service().createCheckpoint(
      { label: "Przed finałem", reasonPl: "Bezpieczny punkt", changeEventId: null },
      metadata,
    );
    expect(result).toMatchObject({ changed: true, checkpointId: "checkpoint-1" });
    const rows = connection.database.select().from(checkpoints).all();
    const events = connection.database.select().from(changeEvents).all();
    expect(rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ checkpointId: "checkpoint-1" });
    expect(events[0]?.beforeJson).toBe(events[0]?.afterJson);
    const row = rows[0]!;
    expect(row).toMatchObject({
      snapshotFormat: "BG3_CAMPAIGN_SNAPSHOT",
      snapshotVersion: 1,
      schemaVersion: 4,
      createdAt: now.toISOString(),
    });
    expect(row).toMatchObject({
      id: "checkpoint-1",
      label: "Przed finałem",
      reasonPl: "Bezpieczny punkt",
    });
    expect(row.snapshotSha256).toBe(calculateSnapshotSha256(row.snapshotJson));
    expect(verifyCheckpointSnapshot(row).state.characters).toEqual([]);
    expect(() => connection.database.delete(checkpoints).run()).toThrow();
  });

  it("links a checkpoint when it captures the referenced event post-state", () => {
    new CharacterMutationService(coordinator()).createCharacter(hero("bohater"), {
      type: "CHARACTER_CREATED",
      summaryPl: "Dodano bohatera",
    });

    const result = service({
      clock: { now: () => new Date("2026-08-26T13:00:00.000Z") },
    }).createCheckpoint(
      { label: "Po dodaniu", reasonPl: "Stan po zmianie", changeEventId: "event-1" },
      metadata,
    );

    expect(result.changed).toBe(true);
    expect(connection.database.select().from(checkpoints).get()?.changeEventId).toBe("event-1");
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(2);
  });

  it("rejects a stale checkpoint event association with zero checkpoint or audit writes", () => {
    const characters = new CharacterMutationService(coordinator());
    characters.createCharacter(hero("bohater"), {
      type: "CHARACTER_CREATED",
      summaryPl: "Dodano bohatera",
    });
    characters.setAttribute(
      { characterId: "bohater", attribute: "STR", baseValue: 17 },
      { type: "ATTRIBUTE_SET", summaryPl: "Zmieniono siłę" },
    );

    expect(() =>
      service().createCheckpoint(
        { label: "Nieaktualny", reasonPl: "Test", changeEventId: "event-1" },
        metadata,
      ),
    ).toThrow(CampaignDomainError);
    expect(connection.database.select().from(checkpoints).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(2);
  });

  it("rejects a missing checkpoint event association with zero writes", () => {
    expect(() =>
      service().createCheckpoint(
        { label: "Brakujące", reasonPl: "Test", changeEventId: "missing-event" },
        metadata,
      ),
    ).toThrow(CampaignDomainError);
    expect(connection.database.select().from(checkpoints).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it.each(["digest", "snapshot", "checkpoint persistence", "audit"] as const)(
    "rolls checkpoint and audit back on %s failure",
    (failure) => {
      if (failure === "checkpoint persistence") {
        connection.database.$client.exec(
          "create trigger fail_checkpoint before insert on checkpoints begin select raise(abort, 'checkpoint failure'); end",
        );
      }
      const digest =
        failure === "digest"
          ? {
              calculate(): string {
                throw new Error("digest");
              },
            }
          : undefined;
      const custom = coordinator(
        failure === "snapshot"
          ? {
              snapshotter: () => ({
                capture(): string {
                  throw new Error("snapshot");
                },
              }),
            }
          : failure === "audit"
            ? {
                auditInsert: () => {
                  throw new Error("audit");
                },
              }
            : {},
      );
      expect(() =>
        new CheckpointMutationService(
          custom,
          { nextId: () => "checkpoint-1" },
          digest,
        ).createCheckpoint({ label: "Test", reasonPl: "Test" }, metadata),
      ).toThrow(CampaignPersistenceError);
      expect(connection.database.select().from(checkpoints).all()).toEqual([]);
      expect(connection.database.select().from(changeEvents).all()).toEqual([]);
    },
  );

  it.each([
    ["label", { label: "   ", reasonPl: "Powód" }],
    ["reasonPl", { label: "Etykieta", reasonPl: "   " }],
  ])("rejects blank checkpoint %s with a domain error and zero writes", (_field, input) => {
    expect(() => service().createCheckpoint(input, metadata)).toThrow(CampaignDomainError);
    expect(connection.database.select().from(checkpoints).all()).toEqual([]);
    expect(connection.database.select().from(changeEvents).all()).toEqual([]);
  });

  it("deserialize and verify are read-only", () => {
    const payload = service().createCheckpoint({ label: "Test", reasonPl: "Test" }, metadata);
    expect(payload.changed).toBe(true);
    const row = connection.database.select().from(checkpoints).get()!;
    const eventsBefore = connection.database.select().from(changeEvents).all();
    const checkpointsBefore = connection.database.select().from(checkpoints).all();
    deserializeCampaignSnapshot(row.snapshotJson);
    verifySnapshotSha256(row.snapshotJson, row.snapshotSha256);
    verifyCheckpointSnapshot(row);
    expect(connection.database.select().from(changeEvents).all()).toEqual(eventsBefore);
    expect(connection.database.select().from(checkpoints).all()).toEqual(checkpointsBefore);
  });
});

function coordinator(overrides: Record<string, unknown> = {}) {
  return new CampaignMutationCoordinator(connection.database, {
    clock: { now: () => now },
    ids: { nextId: () => `event-${++eventId}` },
    ...overrides,
  } as never);
}
function service(overrides: Record<string, unknown> = {}) {
  return new CheckpointMutationService(coordinator(overrides), {
    nextId: () => `checkpoint-${++checkpointId}`,
  });
}
function hero(id: string): Character {
  return {
    id,
    canonicalName: id,
    displayNamePl: "Bohater",
    racePl: null,
    classPl: "Wojownik",
    subclassPl: null,
    level: 1,
    roleSummary: "Front",
    activeParty: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}
