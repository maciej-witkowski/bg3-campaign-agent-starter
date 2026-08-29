import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CampaignImportService } from "../../../src/application/import/campaign-import-service.js";
import type { NormalizedLegacyCampaign } from "../../../src/application/import/legacy-campaign-normalizer.js";
import { LEGACY_TRACKER_PROFILE } from "../../../src/application/import/legacy-tracker-stage.js";
import {
  CampaignDomainError,
  CampaignPersistenceError,
} from "../../../src/domain/mutations/campaign-mutation.js";
import { CampaignMutationCoordinator } from "../../../src/persistence/sqlite/campaign-mutation-coordinator.js";
import { SqliteCampaignImportStateReader } from "../../../src/persistence/sqlite/campaign-import-state-reader.js";
import {
  SQLITE_MEMORY_FILENAME,
  type SqliteConnection,
} from "../../../src/persistence/sqlite/connection.js";
import { openMigratedSqliteConnection } from "../../../src/persistence/sqlite/migrations.js";
import { changeEvents, characters } from "../../../src/persistence/sqlite/schema.js";

const NOW = new Date("2026-08-29T10:00:00.000Z");
let connection: SqliteConnection;

beforeEach(() => {
  connection = openMigratedSqliteConnection({ filename: SQLITE_MEMORY_FILENAME });
});
afterEach(() => connection.close());

describe("CampaignImportService", () => {
  it("applies one aggregate transaction and makes an exact second import a true no-op", () => {
    const service = createService();
    const firstPlan = service.planImport(campaign());
    const first = service.applyImport(firstPlan);
    expect(first).toMatchObject({
      changed: true,
      changeEventId: "event-1",
      report: firstPlan.report,
    });
    expect(connection.database.select().from(characters).all()).toHaveLength(1);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(1);

    const secondPlan = service.planImport(campaign());
    const second = service.applyImport(secondPlan);
    expect(second).toEqual({ changed: false, report: secondPlan.report });
    expect(connection.database.select().from(characters).all()).toHaveLength(1);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(1);
  });

  it("rejects a stale plan before starting its mutation transaction", () => {
    const service = createService();
    const plan = service.planImport(campaign());
    connection.database
      .insert(characters)
      .values({
        id: "external",
        canonicalName: "EXTERNAL",
        displayNamePl: "Zewnętrzna",
        racePl: null,
        classPl: "Klasa",
        subclassPl: null,
        level: 1,
        roleSummary: "Test",
        activeParty: false,
        notes: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      })
      .run();

    expect(() => service.applyImport(plan)).toThrow(CampaignDomainError);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(0);
  });

  it("rolls back every imported row when the audit append fails", () => {
    const coordinator = new CampaignMutationCoordinator(connection.database, {
      clock: { now: () => NOW },
      ids: { nextId: () => "event-1" },
      auditInsert: () => {
        throw new Error("injected audit failure");
      },
    });
    const service = new CampaignImportService(
      new SqliteCampaignImportStateReader(connection.database),
      coordinator,
      sequenceIds(),
    );

    expect(() => service.applyImport(service.planImport(campaign()))).toThrow(
      CampaignPersistenceError,
    );
    expect(connection.database.select().from(characters).all()).toHaveLength(0);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(0);
  });

  it("validates and applies a digest-bound select-existing reconciliation", () => {
    const service = createService();
    service.applyImport(service.planImport(campaign()));
    const conflicting = {
      ...campaign(),
      characters: [{ ...campaign().characters[0]!, classPl: "Wojownik" }],
    };
    const unresolved = service.planImport(conflicting);
    const issue = unresolved.reconciliation.issues.find(
      (value) => value.reasonCode === "CHARACTER_FACT_CONFLICT",
    )!;
    expect(unresolved.blocked).toBe(true);

    const reconciliation = {
      ...unresolved.reconciliation,
      issues: unresolved.reconciliation.issues.map((value) =>
        value.issueId === issue.issueId
          ? {
              ...value,
              resolution: {
                action: "select_existing" as const,
                canonicalEntityId: value.candidateCanonicalIds[0]!,
              },
            }
          : value,
      ),
    };
    const resolved = service.planImport(conflicting, reconciliation);
    expect(resolved.blocked).toBe(false);
    expect(resolved.report.entries).toContainEqual(
      expect.objectContaining({
        entityKind: "character",
        category: "matched",
        reasonCode: "RECONCILED_SELECT_EXISTING",
      }),
    );
    expect(service.applyImport(resolved).changed).toBe(false);

    expect(() =>
      service.planImport(conflicting, { ...reconciliation, workbookSha256: "b".repeat(64) }),
    ).toThrow(CampaignDomainError);
    expect(() =>
      service.planImport(conflicting, {
        ...reconciliation,
        issues: reconciliation.issues.map((value) =>
          value.issueId === issue.issueId
            ? { ...value, resolution: { action: "treat_as_new" as const } }
            : value,
        ),
      }),
    ).toThrow(CampaignDomainError);
  });

  it("rejects copied and modified plans that were not issued intact by the service", () => {
    const service = createService();
    const plan = service.planImport(campaign());

    expect(() => service.applyImport({ ...plan })).toThrow(/nie został wydany/u);

    expect(() => Object.assign(plan.items, { toJSON: () => ({ inventoryItems: [] }) })).toThrow();
    expect(() => (plan.characters.characters as unknown as unknown[]).pop()).toThrow();
    expect(connection.database.select().from(characters).all()).toHaveLength(0);
    expect(connection.database.select().from(changeEvents).all()).toHaveLength(0);
  });
});

function createService(): CampaignImportService {
  const coordinator = new CampaignMutationCoordinator(connection.database, {
    clock: { now: () => NOW },
    ids: { nextId: () => "event-1" },
  });
  return new CampaignImportService(
    new SqliteCampaignImportStateReader(connection.database),
    coordinator,
    sequenceIds(),
  );
}

function campaign(): NormalizedLegacyCampaign {
  return {
    workbookProfile: LEGACY_TRACKER_PROFILE,
    workbookSha256: "a".repeat(64),
    items: [],
    abilities: [],
    spells: [],
    illithidPowers: [],
    issues: [],
    skipped: [],
    characters: [
      {
        sourceKey: "character:HERO",
        source: { profile: LEGACY_TRACKER_PROFILE, sheet: "Postacie", row: 2, field: null },
        canonicalName: "HERO",
        displayNamePl: "Bohater",
        racePl: null,
        classPl: "Czarownik",
        subclassPl: null,
        pactVariantPl: null,
        level: 1,
        roleSummary: "Kontroler",
        activeParty: true,
        notes: null,
        attributes: { STR: 8, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 17 },
        permanentStrengthModifier: null,
        effectiveStrength: 8,
      },
    ],
  };
}

function sequenceIds() {
  let value = 0;
  return { nextId: () => `entity-${++value}` };
}
