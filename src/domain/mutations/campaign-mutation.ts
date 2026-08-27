import type { CampaignValidationViolation } from "../validation/campaign-validation.js";
import type { CampaignStateWriteRepository } from "../repositories/campaign-state-write-repository.js";

export interface Clock {
  now(): Date;
}

export interface IdSource {
  nextId(): string;
}

export interface CampaignSnapshotPort {
  capture(): string;
}

export interface CampaignChangeEventSnapshotPort {
  findAfterSnapshot(changeEventId: string): string | null;
}

export interface CampaignMutationMetadata {
  readonly type: string;
  readonly summaryPl: string;
  readonly characterId?: string | null;
  readonly checkpointId?: string | null;
  readonly reasonPl?: string | null;
  readonly proposalId?: string | null;
  readonly reversesChangeEventId?: string | null;
}

export type CampaignMutationResult =
  | { readonly changed: false }
  | { readonly changed: true; readonly changeEventId: string; readonly occurredAt: Date };

export class CampaignDomainError extends Error {
  public override readonly name = "CampaignDomainError";
}

export class CampaignPersistenceError extends Error {
  public override readonly name = "CampaignPersistenceError";

  public constructor(message = "Nie udało się zapisać zmiany kampanii.") {
    super(message);
  }
}

export interface CampaignValidatorPort {
  validate(): readonly CampaignValidationViolation[];
}

export interface CampaignMutationContext {
  readonly occurredAt: Date;
  readonly snapshotter: CampaignSnapshotPort;
  readonly changeEventSnapshots: CampaignChangeEventSnapshotPort;
}

export type TransactionalMutation = (
  writes: CampaignStateWriteRepository,
  context: CampaignMutationContext,
) => boolean;

export interface CampaignMutationCoordinatorPort {
  execute(
    metadata: CampaignMutationMetadata,
    mutation: TransactionalMutation,
  ): CampaignMutationResult;
}
