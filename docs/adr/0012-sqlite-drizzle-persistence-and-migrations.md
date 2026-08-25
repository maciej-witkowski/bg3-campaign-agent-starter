# ADR-0012: SQLite and Drizzle persistence and migration boundary

Status: Accepted

Milestone: M1 — Canonical Campaign Database

## Context and problem statement

ADR-0001 already selects local SQLite as the only writable canonical campaign store, and ADR-0011 establishes a strict ESM TypeScript project on Node.js 22. M1 must now select a concrete SQLite driver, Drizzle integration, connection policy and migration workflow without allowing schema drift or accidental writes to a real campaign database.

The selected approach must support synchronous, atomic local transactions, committed SQL migrations, isolated temporary databases in tests and later use behind repositories and domain services.

## Decision drivers and invariants

- SQLite remains the only writable canonical store.
- The application must run on the Node.js version range established by ADR-0011.
- Foreign keys must be enforced on every connection.
- Migrations must be reviewable, repeatable and testable from an empty database.
- Tests must never fall back silently to the real campaign database.
- Runtime code must not derive schema by pushing the current TypeScript model directly into a database.
- Database files and SQLite sidecar files are private runtime data and must remain outside version control.

## Considered options

### Option A — Drizzle ORM with `better-sqlite3` and committed Drizzle Kit SQL migrations

This is Drizzle's directly supported local Node.js SQLite integration. It provides a small synchronous driver API that maps naturally to SQLite transactions and supports Drizzle's embedded migrator.

### Option B — Drizzle ORM with libSQL/Turso-compatible client

This would keep a possible remote protocol available, but introduces a client and operational model not required by the local-only M1 scope. It also weakens the signal that the canonical database is a local SQLite file.

### Option C — Node's built-in `node:sqlite` with hand-written mapping

This removes a native third-party driver but does not provide the required Drizzle integration as a stable, documented M1 path. It would also require more persistence plumbing unrelated to campaign correctness.

### Option D — Raw `better-sqlite3` without Drizzle

This gives direct control but contradicts the roadmap's Drizzle deliverable and would duplicate schema typing and migration infrastructure.

### Option E — Keep M0 without a database

The status quo cannot satisfy M1.

## Proposed decision and rationale

Use Drizzle ORM's `better-sqlite3` adapter for M1 and Drizzle Kit to generate versioned SQL migrations. Pin exact compatible stable package versions during implementation and commit the lockfile, generated SQL and Drizzle migration metadata.

Provide an application-owned database factory that requires an explicit filename or the explicit SQLite in-memory sentinel. It will:

- open the native SQLite connection;
- enable foreign-key enforcement;
- set a bounded busy timeout;
- use write-ahead logging and full synchronous durability for file-backed campaign databases;
- avoid file-only pragmas for in-memory test databases;
- return the typed Drizzle connection together with an explicit close operation.

Provide a separate explicit migration entry point using Drizzle's embedded migrator. Migrations run before repositories or domain services are made available. Production code will not use `drizzle-kit push`, implicit schema synchronization or destructive reset helpers.

The first migration creates the M1 schema. Future changes must add forward migrations; previously committed migration files are immutable after release.

References:

- [Drizzle SQLite documentation](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
- [Drizzle Kit migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)

## Boundaries and dependency direction

- Drizzle schema and connection details live in the persistence layer.
- Repositories depend on the typed Drizzle database.
- Domain services depend on repository interfaces and the transaction coordinator, not on `better-sqlite3` or arbitrary SQL.
- Adapters, future tools and models never receive the native connection or Drizzle database object.
- Package-root exports expose safe construction, migration and domain/repository interfaces only where needed; they do not expose unrestricted write access.

## Data, migration and compatibility impact

- M1 adds the initial empty-to-latest SQLite migration; it does not import or rewrite `campaign/import/BG3_Campaign_Tracker.xlsx`.
- The migration operates on a new database and contains no real campaign facts.
- IDs, timestamps and JSON representation are decided in ADR-0013.
- Native driver installation must be verified on the supported Node.js and CI environment.
- SQLite database, `-wal`, `-shm`, backup and temporary files must be covered by ignore rules without ignoring committed migration SQL.

## Transaction, validation, audit and rollback impact

This ADR provides the connection and transaction-capable persistence foundation. The mutation protocol, validation order and audit guarantees are defined in ADR-0014.

Connection pragmas are part of database initialization and must be asserted in integration tests. A migration failure must leave the database at a consistent migration boundary and must prevent domain services from starting.

## Security, privacy and external-data impact

- The database filename is always supplied explicitly; tests use isolated temporary or in-memory databases.
- No networked database service is introduced.
- Database files and sidecars are treated as private campaign data under ADR-0010.
- M1 does not read external research or import the real tracker.
- SQL migration files contain structure only and no campaign data.

## Required tests and operational evidence

- Apply all committed migrations to an empty file-backed database.
- Apply migrations twice and prove the second application is a no-op.
- Open an in-memory database without creating files.
- Assert foreign keys are enabled for every database factory result.
- Assert configured file-backed durability pragmas.
- Prove a failed migration does not expose a usable partially initialized domain store.
- Run a frozen clean install and the full M0 quality gate after adding dependencies.
- Run a high-severity dependency audit and document any native-driver compatibility risk.

## Implementation evidence

- Pinned runtime packages: `drizzle-orm@0.45.2` and `better-sqlite3@13.0.3`.
- Pinned development packages: `drizzle-kit@0.31.10` and `@types/better-sqlite3@9.6.0`.
- `better-sqlite3@13.0.3` declares Node.js `>=22` and loaded its Windows x64 prebuild successfully on Node.js 24.19.0; CI must still verify the repository minimum Node.js 22.13.0.
- The connection factory applies `foreign_keys=ON` and a 5,000 ms busy timeout to every connection. File-backed connections additionally use WAL and `synchronous=FULL`; the explicit `:memory:` sentinel skips file-only pragmas.
- The application migrator closes the connection when migration initialization fails. Integration tests demonstrate transactional rollback, closed-handle behavior and idempotent reapplication using isolated file-backed databases.
- Build scripts for `better-sqlite3` and `esbuild` are denied explicitly because the selected packages work from supplied platform artifacts in the validated environment. A frozen clean install verifies this policy.
- `pnpm audit --audit-level high` passes. The package graph contains one moderate, development-only esbuild advisory through Drizzle Kit's legacy loader; no development server from that dependency is used by this project.

## Consequences and trade-offs

- The synchronous driver simplifies local transaction boundaries and rollback reasoning.
- Native-module installation is heavier than a pure JavaScript dependency and must be validated on supported platforms.
- WAL may create private sidecar files while the database is open.
- Full synchronous durability favors campaign-state correctness over peak write throughput.
- Explicit migration execution makes startup order visible but adds an initialization step.

## Rejected alternatives

- libSQL is rejected for M1 because remote-capable operation is outside scope.
- `node:sqlite` is rejected until a stable, documented Drizzle integration satisfies the same evidence.
- raw SQL-only persistence is rejected because it loses the required Drizzle schema boundary.
- `drizzle-kit push` is rejected for canonical databases because it does not provide the committed, auditable forward migration chain required by the project.

## Unresolved questions

None blocking. Exact dependency versions will be selected from compatible stable releases during implementation and recorded as implementation evidence without changing this decision.

## Approval record

- Approved by the repository owner in the Codex task on 2026-08-26.
- Approval scope: the complete ADR-0012 proposal without requested changes.

## Change log

- 2026-08-26 — Initial M1 proposal.
- 2026-08-26 — Accepted after explicit user approval.
- 2026-08-26 — Recorded pinned dependency versions, connection policy and validation evidence from the ADR-0012 implementation session.
