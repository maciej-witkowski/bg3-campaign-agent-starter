import { sql } from "drizzle-orm";

import type { CampaignSnapshotPort } from "../../domain/mutations/campaign-mutation.js";
import {
  CAMPAIGN_SNAPSHOT_FORMAT,
  CAMPAIGN_SNAPSHOT_VERSION,
  serializeCampaignSnapshot,
} from "../../domain/snapshots/campaign-snapshot.js";
import {
  abilities,
  characterAbilities,
  characterAttributes,
  characterIllithidPowers,
  characterSpells,
  characters,
  equipment,
  illithidPowerPrerequisites,
  illithidPowers,
  inventoryItems,
  itemDefinitions,
  itemEffects,
  permanentModifiers,
  spells,
} from "./schema.js";
import type { SqliteTransactionState } from "./transaction-types.js";

export function createSqliteCampaignSnapshotPort(
  transaction: SqliteTransactionState,
  capturedAt: Date,
): CampaignSnapshotPort {
  return {
    capture(): string {
      const migration = transaction.get<{ count: number }>(
        sql`select count(*) as count from __drizzle_migrations`,
      );
      return serializeCampaignSnapshot({
        format: CAMPAIGN_SNAPSHOT_FORMAT,
        version: CAMPAIGN_SNAPSHOT_VERSION,
        schemaVersion: migration?.count ?? 0,
        capturedAt: capturedAt.toISOString(),
        state: {
          characters: transaction.select().from(characters).all(),
          characterAttributes: transaction.select().from(characterAttributes).all(),
          permanentModifiers: transaction.select().from(permanentModifiers).all(),
          itemDefinitions: transaction.select().from(itemDefinitions).all(),
          itemEffects: transaction.select().from(itemEffects).all(),
          inventoryItems: transaction.select().from(inventoryItems).all(),
          equipment: transaction.select().from(equipment).all(),
          spells: transaction.select().from(spells).all(),
          characterSpells: transaction.select().from(characterSpells).all(),
          abilities: transaction.select().from(abilities).all(),
          characterAbilities: transaction.select().from(characterAbilities).all(),
          illithidPowers: transaction.select().from(illithidPowers).all(),
          illithidPowerPrerequisites: transaction.select().from(illithidPowerPrerequisites).all(),
          characterIllithidPowers: transaction.select().from(characterIllithidPowers).all(),
        },
      });
    },
  };
}
