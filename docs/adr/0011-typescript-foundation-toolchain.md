# 0011 — TypeScript foundation toolchain

Status: Accepted

## Context

M0 needs a reproducible repository foundation before campaign, database, AI or adapter logic is introduced. The project requires strict typing, deterministic dependency installation, automated quality gates and environment validation that can be tested without mutating the process environment.

## Decision

- Use a single private ESM package on Node.js 22.13 or newer, managed by the pnpm version pinned in `packageManager`.
- Compile with TypeScript in strict `NodeNext` mode and enable additional checks for unchecked indexing, unused code, optional properties and switch fallthrough.
- Use ESLint flat configuration, Prettier and Vitest as independent quality tools.
- Keep environment loading explicit: `loadEnvironment()` reads `.env`, while `parseEnvironment()` accepts an injected source for deterministic validation and tests.
- Run formatting checks, lint, typecheck, tests and build in CI. Install dependencies from the committed lockfile.

## Consequences

- Contributors need a compatible Node.js release and Corepack/pnpm.
- Runtime modules use ESM and `.js` specifiers in TypeScript source imports.
- New environment variables must be added to the Zod schema, `.env.example` and tests together.
- Later milestones may add packages and source folders, but they must preserve these quality gates.

## Supersession

Supersedes no earlier ADR. A future toolchain change must add a new ADR and reference this record.
