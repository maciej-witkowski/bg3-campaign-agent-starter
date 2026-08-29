import type {
  ImportEntityKind,
  ImportReconciliation,
  ImportReconciliationResolution,
  ImportSourceLocation,
} from "./import-contracts.js";

export type ImportPlanningDecisions = ReadonlyMap<string, ImportReconciliationResolution>;

export function planningDecisionKey(
  entityKind: ImportEntityKind,
  source: ImportSourceLocation,
  reasonCode: string,
): string {
  return `${entityKind}\u0000${source.sheet}\u0000${source.row}\u0000${source.field ?? ""}\u0000${reasonCode}`;
}

export function findPlanningDecision(
  decisions: ImportPlanningDecisions | undefined,
  entityKind: ImportEntityKind,
  source: ImportSourceLocation,
  reasonCode: string,
): ImportReconciliationResolution | null {
  return decisions?.get(planningDecisionKey(entityKind, source, reasonCode)) ?? null;
}

export function reconciliationIssueIdentity(
  issue: Pick<
    ImportReconciliation["issues"][number],
    | "issueId"
    | "entityKind"
    | "source"
    | "category"
    | "reasonCode"
    | "candidateCanonicalIds"
    | "rawFacts"
  >,
): string {
  return JSON.stringify({
    issueId: issue.issueId,
    entityKind: issue.entityKind,
    source: issue.source,
    category: issue.category,
    reasonCode: issue.reasonCode,
    candidateCanonicalIds: [...issue.candidateCanonicalIds].sort(),
    rawFacts: Object.fromEntries(
      Object.entries(issue.rawFacts).sort(([left], [right]) => left.localeCompare(right)),
    ),
  });
}
