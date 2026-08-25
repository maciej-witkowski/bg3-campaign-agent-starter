# Contributing

This is a state-critical personal campaign application. Changes should be small, reviewable and milestone-scoped.

## Pull request expectations

- Reference a roadmap milestone or explicit issue.
- Explain state-model impact.
- Add tests for mutation behavior.
- Add scenario regression tests for agent behavior changes.
- Update docs and CHANGELOG.
- Never include API keys, campaign database backups or private audio recordings in Git.

## Local quality gates

Use the Node.js and pnpm versions declared in `package.json`. Install with `pnpm install --frozen-lockfile`, then run `pnpm check` before requesting review. CI runs the same formatting, lint, typecheck, test and build checks.

When adding an environment variable, update the Zod schema in `src/config/environment.ts`, `.env.example` and the configuration tests in the same change.

Architecture decisions follow the convention in `docs/adr/README.md`.
