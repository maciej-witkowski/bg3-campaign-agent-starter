import { z } from "zod";

export const IMPORT_REPORT_FORMAT = "BG3_IMPORT_REPORT" as const;
export const IMPORT_REPORT_VERSION = 1 as const;
export const IMPORT_RECONCILIATION_FORMAT = "BG3_IMPORT_RECONCILIATION" as const;
export const IMPORT_RECONCILIATION_VERSION = 1 as const;

export const IMPORT_REPORT_CATEGORIES = [
  "inserted",
  "matched",
  "skipped",
  "ambiguous",
  "conflicts",
] as const;
export type ImportReportCategory = (typeof IMPORT_REPORT_CATEGORIES)[number];

export const IMPORT_ENTITY_KINDS = [
  "character",
  "attribute",
  "permanent_modifier",
  "item_definition",
  "item_effect",
  "inventory_item",
  "equipment_assignment",
  "spell",
  "character_spell",
  "ability",
  "character_ability",
  "illithid_power",
  "illithid_prerequisite",
  "character_illithid_power",
  "legacy_change_event",
  "workbook_content",
] as const;
export type ImportEntityKind = (typeof IMPORT_ENTITY_KINDS)[number];

export interface ImportSourceLocation {
  readonly profile: string;
  readonly sheet: string;
  readonly row: number;
  readonly field: string | null;
}

export interface ImportReportEntry {
  readonly category: ImportReportCategory;
  readonly entityKind: ImportEntityKind;
  readonly source: ImportSourceLocation;
  readonly sourceKey: string;
  readonly reasonCode: string;
  readonly messagePl: string;
  readonly blocking: boolean;
  readonly canonicalEntityId: string | null;
  readonly relatedIds: readonly string[];
}

export interface ImportReport {
  readonly format: typeof IMPORT_REPORT_FORMAT;
  readonly version: typeof IMPORT_REPORT_VERSION;
  readonly workbookProfile: string;
  readonly workbookSha256: string;
  readonly entries: readonly ImportReportEntry[];
}

const sourceLocationSchema = z
  .object({
    profile: z.string().trim().min(1),
    sheet: z.string().trim().min(1),
    row: z.number().int().positive(),
    field: z.string().trim().min(1).nullable(),
  })
  .strict();

const reportEntrySchema = z
  .object({
    category: z.enum(IMPORT_REPORT_CATEGORIES),
    entityKind: z.enum(IMPORT_ENTITY_KINDS),
    source: sourceLocationSchema,
    sourceKey: z.string().trim().min(1),
    reasonCode: z.string().trim().min(1),
    messagePl: z.string().trim().min(1),
    blocking: z.boolean(),
    canonicalEntityId: z.string().trim().min(1).nullable(),
    relatedIds: z.array(z.string().trim().min(1)),
  })
  .strict();

export const importReportSchema = z
  .object({
    format: z.literal(IMPORT_REPORT_FORMAT),
    version: z.literal(IMPORT_REPORT_VERSION),
    workbookProfile: z.string().trim().min(1),
    workbookSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    entries: z.array(reportEntrySchema),
  })
  .strict();

const selectExistingResolutionSchema = z
  .object({
    action: z.literal("select_existing"),
    canonicalEntityId: z.string().trim().min(1),
  })
  .strict();
const treatAsNewResolutionSchema = z.object({ action: z.literal("treat_as_new") }).strict();
const provideCanonicalValueResolutionSchema = z
  .object({
    action: z.literal("provide_canonical_value"),
    value: z.union([z.string(), z.number().finite(), z.boolean()]),
  })
  .strict();
const attestVerifiedAliasResolutionSchema = z
  .object({
    action: z.literal("attest_verified_alias"),
    aliasEn: z.string().trim().min(1),
  })
  .strict();
const skipResolutionSchema = z.object({ action: z.literal("skip") }).strict();

export const importReconciliationResolutionSchema = z.discriminatedUnion("action", [
  selectExistingResolutionSchema,
  treatAsNewResolutionSchema,
  provideCanonicalValueResolutionSchema,
  attestVerifiedAliasResolutionSchema,
  skipResolutionSchema,
]);
export type ImportReconciliationResolution = z.infer<typeof importReconciliationResolutionSchema>;

const reconciliationIssueSchema = z
  .object({
    issueId: z.string().trim().min(1),
    entityKind: z.enum(IMPORT_ENTITY_KINDS),
    source: sourceLocationSchema,
    category: z.enum(["ambiguous", "conflicts"]),
    reasonCode: z.string().trim().min(1),
    candidateCanonicalIds: z.array(z.string().trim().min(1)),
    rawFacts: z.record(
      z.string(),
      z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    ),
    resolution: importReconciliationResolutionSchema.nullable(),
  })
  .strict();

export const importReconciliationSchema = z
  .object({
    format: z.literal(IMPORT_RECONCILIATION_FORMAT),
    version: z.literal(IMPORT_RECONCILIATION_VERSION),
    workbookProfile: z.string().trim().min(1),
    workbookSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    issues: z.array(reconciliationIssueSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const issueIds = new Set<string>();
    for (const [index, issue] of value.issues.entries()) {
      if (issueIds.has(issue.issueId)) {
        context.addIssue({
          code: "custom",
          path: ["issues", index, "issueId"],
          message: "Identyfikator problemu rekonsyliacji musi być unikalny.",
        });
      }
      issueIds.add(issue.issueId);

      const candidateIds = new Set(issue.candidateCanonicalIds);
      if (candidateIds.size !== issue.candidateCanonicalIds.length) {
        context.addIssue({
          code: "custom",
          path: ["issues", index, "candidateCanonicalIds"],
          message: "Lista kandydatów nie może zawierać duplikatów.",
        });
      }
      if (
        issue.resolution?.action === "select_existing" &&
        !candidateIds.has(issue.resolution.canonicalEntityId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["issues", index, "resolution", "canonicalEntityId"],
          message: "Wybrany identyfikator nie znajduje się na liście kandydatów.",
        });
      }
    }
  });

export type ImportReconciliation = z.infer<typeof importReconciliationSchema>;

export function parseImportReconciliation(value: unknown): ImportReconciliation {
  return importReconciliationSchema.parse(value);
}

export function parseImportReport(value: unknown): ImportReport {
  return importReportSchema.parse(value);
}
