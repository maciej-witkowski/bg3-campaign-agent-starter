# BG3 Campaign Agent

Persistent local-first Baldur's Gate 3 campaign manager with AI-assisted build, equipment, spell and item analysis.

Implementation is intentionally staged through `ROADMAP.md`. M1 provides the canonical SQLite persistence and typed campaign-state domain foundation; later milestones add imports, read-only tools and agent-facing behavior.

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
| `pnpm check` | Run formatting check, lint, typecheck, tests and build. |
| `pnpm db:generate` | Generate a committed Drizzle SQL migration after an approved schema change. |
| `pnpm format` | Apply Prettier to maintained source/configuration files. |
| `pnpm format:check` | Verify formatting without modifying files. |
| `pnpm lint` | Run ESLint with warnings treated as failures. |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Run Vitest interactively in watch mode. |
| `pnpm typecheck` | Check strict TypeScript types without emitting files. |

## Current repository contents

The repository contains the M1 canonical SQLite schema and migrations, typed read/write boundaries, campaign validation, append-only mutation audit, deterministic snapshots and checkpoints, plus the M0 TypeScript foundation and product documentation. M1 intentionally does not include campaign import, restore/undo, OpenAI integration, voice or UI implementation.
