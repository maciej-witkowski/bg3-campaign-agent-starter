# BG3 Campaign Agent

Persistent local-first Baldur's Gate 3 campaign manager with AI-assisted build, equipment, spell and item analysis.

Implementation is intentionally staged through `ROADMAP.md`. M0 provides the repository toolchain and validated environment foundation; campaign logic begins in later milestones.

## Start here

1. Read `SPECIFICATION.md`.
2. Read `AGENTS.md`.
3. Follow `ROADMAP.md` milestone by milestone.
4. Use prompts under `prompts/milestones/` when delegating implementation to Codex.

## Canonical state

The final application will use SQLite as the only writable source of truth. XLSX/JSON are exports, not writable authorities.

## Requirements

- Node.js 22.13 or newer;
- pnpm 11.19 (pinned through the `packageManager` field).

## Setup

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
```

Copying `.env.example` is optional for M0 because all current settings have safe development defaults. Never commit `.env`.

## Package scripts

| Command | Purpose |
| --- | --- |
| `pnpm build` | Compile production ESM output into `dist/`. |
| `pnpm check` | Run formatting check, lint, typecheck, tests and build. |
| `pnpm format` | Apply Prettier to maintained source/configuration files. |
| `pnpm format:check` | Verify formatting without modifying files. |
| `pnpm lint` | Run ESLint with warnings treated as failures. |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Run Vitest interactively in watch mode. |
| `pnpm typecheck` | Check strict TypeScript types without emitting files. |

## Current repository contents

The repository contains the M0 TypeScript foundation, product/architecture documentation, ADRs, JSON schemas, example tool-call JSONL, regression scenarios and milestone prompts. M0 intentionally contains no database schema, OpenAI integration, voice or UI implementation.
