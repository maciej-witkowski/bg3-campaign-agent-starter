# BG3 Campaign Agent

Persistent local-first Baldur's Gate 3 campaign manager with AI-assisted build, equipment, spell and item analysis.

Implementation is intentionally staged through `ROADMAP.md`. M1 provides the canonical
SQLite persistence and typed campaign-state domain foundation. M2 adds a conservative
legacy-tracker import, reconciliation/report artifacts and lossless current-state
JSON/XLSX exchange. M3 adds a local read-only inspection CLI without AI; later milestones
add typed model tools and agent-facing behavior.

## Start here

1. Read `SPECIFICATION.md`.
2. Read `AGENTS.md`.
3. Follow `ROADMAP.md` milestone by milestone.
4. Use prompts under `prompts/milestones/` when delegating implementation to Codex.
5. Follow `docs/MILESTONE_DELIVERY_WORKFLOW.md` through PR checks, AI review and human approval.

## Canonical state

SQLite is the only writable source of truth. XLSX/JSON are exports, not writable authorities. M1 mutations use typed domain services, transaction-scoped repositories, pre-commit validation and append-only audit events.

## Requirements

- Node.js 22.14 or newer;
- pnpm 11.19 (pinned through the `packageManager` field).
- Python 3 and a native C++ build toolchain for clean `better-sqlite3` installation (`Desktop development with C++` on Windows; the standard compiler/make toolchain on Linux).

## Setup

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
```

Copying `.env.example` is optional because all current settings have safe development defaults. Never commit `.env`.

## Package scripts

| Command | Purpose |
| --- | --- |
| `pnpm build` | Compile production ESM output into `dist/`. |
| `pnpm cli -- <args>` | Run the built M3 `bg3-campaign` CLI. |
| `pnpm check` | Run formatting check, lint, typecheck, tests and build. |
| `pnpm db:generate` | Generate a committed Drizzle SQL migration after an approved schema change. |
| `pnpm format` | Apply Prettier to maintained source/configuration files. |
| `pnpm format:check` | Verify formatting without modifying files. |
| `pnpm lint` | Run ESLint with warnings treated as failures. |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Run Vitest interactively in watch mode. |
| `pnpm typecheck` | Check strict TypeScript types without emitting files. |

## M2 import/export

The original tracker is parsed as private, untrusted input. Import is planned before one validated and audited transaction; the same source imported twice is a no-op. Generated reports, reconciliation documents, SQLite databases and exports under `campaign/exports/` are ignored by Git. See `docs/IMPORT_EXPORT.md` for the supported profiles and local acceptance command.

## M3 read-only CLI

Build once, then point every data command at one explicit existing latest-schema
database:

```sh
pnpm build
pnpm cli -- --db campaign/current.sqlite party
pnpm cli -- --db campaign/current.sqlite --json character "Lae'zel"
pnpm cli -- --db campaign/current.sqlite export --format json --output campaign/exports/state.json
```

The CLI never migrates or mutates SQLite. `export` writes only the explicit artifact and
refuses an existing target unless `--overwrite` is supplied. See `docs/CLI.md` for the
complete grammar, filters, JSON contract and exit statuses.

The repository does not yet include restore/undo, OpenAI integration, voice or desktop
UI implementation.
