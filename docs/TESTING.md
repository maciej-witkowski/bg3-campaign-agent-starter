# Testing Strategy

## M0 quality gates

The repository-level gate is `pnpm check`. It verifies formatting, lint, strict TypeScript types, the Vitest suite and a production build. CI installs only from `pnpm-lock.yaml` and runs the same checks on Node.js 22.14.0.

M0 unit tests cover environment defaults, accepted values, blank values and safe validation failures. Later milestone test categories below become active when their corresponding implementation is added.

## Unit tests
Pure functions, schemas, resolver scoring, effective attribute calculations, domain invariants.

## Repository tests
SQLite CRUD and query semantics against temporary databases.

## Transaction tests
Verify rollback on invariant failure.

## Migration tests
Apply all migrations from an empty database and from supported committed migration
boundaries. Upgrade fixtures use the actual immutable SQL files, seed sanitized legacy
rows, apply only the newer migration, and assert payload/data preservation, explicit
backfill metadata and `PRAGMA foreign_key_check` integrity. Checkpoint compatibility
coverage includes upgrades stopped before metadata introduction and databases that
already applied the incorrect legacy classification, while proving valid V1 rows are
not reclassified.

## Tool contract tests
Every tool validates input and stable result envelope.

## Scenario tests
Natural-language/domain workflows with expected mutation/no-mutation behavior.

## Model evals
Run curated cases to detect hallucinated item mapping, accidental state mutation, missing opportunity cost and failure to load canonical state.

## Bug policy
Every campaign-state bug discovered in real use should become a regression test before or together with the fix.

## M2 import/export evidence

Sanitized unit and integration tests cover workbook structure and archive limits, exact Polish normalization, closed mappings, duplicate/collision planning, bounded reconciliation application, rollback, transactional stale-plan rejection, idempotency, strict report/reconciliation contracts, refusal to export invalid state, formula-safe XLSX output and stable-ID current-state imports.

Review regressions additionally cover rejection of copied or mutated import plans, conflicting assignments within one pending plan and a 1,000-record canonical XLSX round trip that exceeds the legacy tracker row bound.

Further planner regressions preserve distinct source rows for repeated assignment conflicts, allow multiple different illithid prerequisite relations and verify that sold inventory never receives an owner.

Issued-plan regressions reject copied objects, nested mutation and injected `toJSON` hooks. Equipment regressions detect collisions with assignments pending in the same plan and ensure a skipped new equipped item cannot leave ownerless invalid inventory behind.

Normalization regressions reject duplicate character display names before dependent
reference lookup and allow one illithid power to appear for different characters with
different availability/acquisition statuses.

Reconciliation regressions also refuse changing or skipping only one duplicated
character row, preventing unchanged dependent references from resolving to the first
same-named character.

Private acceptance uses `scripts/verify-m2-real-import.mjs` only after `pnpm build`. It refuses existing targets, imports the real tracker into a new database, repeats the import, verifies SQLite integrity and foreign keys, exports JSON/XLSX, imports both into separate fresh databases and compares canonical state digests. Generated evidence remains under ignored `campaign/exports/`.

## M3 read-only CLI evidence

Sanitized unit/integration coverage verifies the existing-file-only SQLite connection,
query-only write refusal, byte-identical database files, exact migration hash/timestamp
compatibility and refusal of missing, old, new, tampered or incomplete schemas.

Application tests cover active-party projection, base/effective attributes, canonical
and Polish/NFC character resolution, ambiguity/not-found, equipment joins, inventory
filter AND/OR behavior, exact effect facets, spell flags, illithid non-inference,
summary-only audit limits/order, validation and explicit export isolation. Regressions
also reject equipment rows with contradictory status, owner, quantity or known slot.

CLI contract tests cover every command grammar, help/version, duplicate/unknown/missing
arguments, V1 success/failure envelopes, Unicode/null/date serialization, stdout/stderr
separation, human output, exit categories, safe internal errors and JSON/XLSX dispatch.
Human party-output coverage requires every base/effective attribute pair from the DTO.

After the production build, `scripts/smoke-production.mjs` creates a sanitized temporary
latest-schema database and launches the actual `dist/cli/main.js` child process for all
nine commands. Every JSON envelope and the export artifact are parsed, and the SQLite
SHA-256 before/after all commands must match. The smoke also attempts overwrite exports
against the database, WAL and SHM paths and requires a safe exit-5 refusal.

Direct M3 composition coverage invokes both public export writers and proves the same
database/SQLite-companion target policy cannot be bypassed outside the CLI adapter. A
relative-path regression changes the process working directory after opening and still
requires the original database path to remain protected.

Both equipment and inventory projections reject joined equipment facts with a
contradictory status, owner, quantity or known definition slot.

Validation-port regression uses two SQLite connections in WAL mode. A writer commits
between two reads inside the validation callback; both reads must observe the original
snapshot, while a later transaction observes the committed row.
