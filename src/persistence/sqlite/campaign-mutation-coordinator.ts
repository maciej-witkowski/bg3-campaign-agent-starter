import { eq } from "drizzle-orm";

import type {
  CampaignMutationCoordinatorPort,
  CampaignMutationMetadata,
  CampaignMutationResult,
  CampaignSnapshotPort,
  CampaignValidatorPort,
  Clock,
  IdSource,
  TransactionalMutation,
  TransactionalPrecondition,
} from "../../domain/mutations/campaign-mutation.js";
import {
  CampaignDomainError,
  CampaignPersistenceError,
} from "../../domain/mutations/campaign-mutation.js";
import {
  CampaignValidationError,
  validateCampaignState,
} from "../../domain/validation/campaign-validation.js";
import type { SqliteDatabase } from "./connection.js";
import { SqliteCampaignStateWriteRepository } from "./campaign-state-write-repository.js";
import { SqliteCampaignValidationStateReader } from "./campaign-validation-state-reader.js";
import { createSqliteCampaignSnapshotPort } from "./campaign-snapshot.js";
import { changeEvents } from "./schema.js";
import type { SqliteTransaction } from "./transaction-types.js";

export interface CampaignMutationCoordinatorDependencies {
  readonly clock: Clock;
  readonly ids: IdSource;
  readonly snapshotter?: (transaction: SqliteTransaction, capturedAt: Date) => CampaignSnapshotPort;
  readonly validator?: (transaction: SqliteTransaction) => CampaignValidatorPort;
  readonly auditInsert?: (
    transaction: SqliteTransaction,
    event: typeof changeEvents.$inferInsert,
  ) => void;
}

export class CampaignMutationCoordinator implements CampaignMutationCoordinatorPort {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly dependencies: CampaignMutationCoordinatorDependencies,
  ) {}

  /** Internal orchestration API. Adapter-facing exports expose only typed services. */
  public execute(
    metadata: CampaignMutationMetadata,
    mutation: TransactionalMutation,
    precondition?: TransactionalPrecondition,
  ): CampaignMutationResult {
    const occurredAt = this.dependencies.clock.now();
    const changeEventId = this.dependencies.ids.nextId();

    try {
      return this.database.transaction((transaction) => {
        precondition?.();
        const snapshotter =
          this.dependencies.snapshotter?.(transaction, occurredAt) ??
          createSqliteCampaignSnapshotPort(transaction, occurredAt);
        const beforeJson = snapshotter.capture();
        const changed = mutation(new SqliteCampaignStateWriteRepository(transaction), {
          occurredAt,
          snapshotter,
          changeEventSnapshots: {
            findAfterSnapshot(changeEventId) {
              return (
                transaction
                  .select({ afterJson: changeEvents.afterJson })
                  .from(changeEvents)
                  .where(eq(changeEvents.id, changeEventId))
                  .get()?.afterJson ?? null
              );
            },
          },
        });
        if (!changed) return { changed: false } as const;

        const validator =
          this.dependencies.validator?.(transaction) ?? new DefaultCampaignValidator(transaction);
        const violations = validator.validate();
        if (violations.length > 0) throw new CampaignValidationError(violations);

        const afterJson = snapshotter.capture();
        const event: typeof changeEvents.$inferInsert = {
          id: changeEventId,
          occurredAt: occurredAt.toISOString(),
          type: requiredText(metadata.type, "type"),
          characterId: nullableText(metadata.characterId, "characterId"),
          checkpointId: nullableText(metadata.checkpointId, "checkpointId"),
          proposalId: nullableText(metadata.proposalId, "proposalId"),
          summaryPl: requiredText(metadata.summaryPl, "summaryPl"),
          reasonPl: nullableText(metadata.reasonPl, "reasonPl"),
          beforeJson,
          afterJson,
          reversesChangeEventId: nullableText(
            metadata.reversesChangeEventId,
            "reversesChangeEventId",
          ),
        };
        const auditInsert =
          this.dependencies.auditInsert ??
          ((tx: SqliteTransaction, row: typeof changeEvents.$inferInsert) => {
            tx.insert(changeEvents).values(row).run();
          });
        auditInsert(transaction, event);
        return { changed: true, changeEventId, occurredAt } as const;
      });
    } catch (error: unknown) {
      if (error instanceof CampaignValidationError || error instanceof CampaignDomainError) {
        throw error;
      }
      throw new CampaignPersistenceError();
    }
  }
}

class DefaultCampaignValidator implements CampaignValidatorPort {
  private readonly reader: SqliteCampaignValidationStateReader;

  public constructor(transaction: SqliteTransaction) {
    this.reader = new SqliteCampaignValidationStateReader(transaction);
  }

  public validate() {
    return validateCampaignState(this.reader);
  }
}

function requiredText(value: string, field: string): string {
  if (value.trim() === "") throw new CampaignDomainError(`${field} nie może być puste.`);
  return value;
}

function nullableText(value: string | null | undefined, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (value.trim() === "") throw new CampaignDomainError(`${field} nie może być puste.`);
  return value;
}
