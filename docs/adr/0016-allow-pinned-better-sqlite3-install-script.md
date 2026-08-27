# ADR-0016: Allow the pinned better-sqlite3 installation script

Status: Accepted

Milestone: M1 — Canonical Campaign Database

Supersedes in part: ADR-0012 implementation evidence concerning blocked build scripts

## Context and problem statement

ADR-0012 selected `better-sqlite3@13.0.3` and assumed its lifecycle script could remain denied because supplied platform artifacts were sufficient. Two clean GitHub Actions runs on Ubuntu and Node.js 22.13.0 disproved that assumption: installation, formatting, lint and typecheck passed, then all six Vitest workers importing SQLite persistence exited unexpectedly while the three non-persistence files passed.

`pnpm-workspace.yaml` explicitly denies the driver build, and `pnpm ignored-builds` confirms it is blocked. The successful local Windows clean install had a compatible artifact in the local package environment and is not portable Linux evidence. Changing lifecycle-script permission is a supply-chain and portability decision requiring explicit approval.

## Decision drivers and invariants

- Keep the accepted SQLite/Drizzle architecture and exact driver version.
- A frozen clean install must yield a loadable driver on supported Node.js 22+ systems.
- Allow lifecycle scripts only for an explicitly reviewed, pinned package.
- Keep `esbuild` denied.
- Preserve lockfile integrity, audit and CI gates.
- Do not change schemas, migrations, campaign state or domain behavior.

## Considered options

### Option A — Allow only the pinned better-sqlite3 lifecycle script

Set `allowBuilds.better-sqlite3` to `true` and leave `esbuild` denied. For the pinned package, pnpm invokes the implicit `node-gyp rebuild`, requiring Python and a platform C++ build toolchain.

### Option B — Keep scripts denied and reduce Vitest concurrency

This cannot install a missing binding. The persistence/non-persistence split in both CI runs rejects it as a root-cause fix.

### Option C — Vendor platform-native binaries

This expands repository size, provenance risk and platform maintenance and is rejected for M1.

### Option D — Replace the driver

Using `node:sqlite`, WASM or another driver would replace the accepted persistence architecture and require broader rework. The current failure does not justify it.

### Option E — Build manually only in CI

This creates environment drift and bypasses the package manager permission model, so it is rejected.

## Proposed decision and rationale

Approve only exactly pinned `better-sqlite3@13.0.3`:

```yaml
allowBuilds:
  better-sqlite3: true
  esbuild: false
```

Keep versions and lockfile unchanged and add no CI-only install command. This is the smallest correction using the same frozen installation path locally and in CI. Update ADR-0012 evidence to reference this superseding decision and remove the disproved portability claim.

## Boundaries and dependency direction

Only installation policy changes. Persistence, repository, domain and adapter boundaries remain unchanged. No new runtime interface or raw SQL access is introduced.

## Data, migration and compatibility impact

- No schema or migration changes; all migration hashes remain unchanged.
- No campaign data is read or written during installation.
- Clean installation compiles the pinned native driver and therefore requires Python and a platform C++ build toolchain.

## Transaction, validation, audit and rollback impact

None. ADR-0014 and ADR-0015 semantics remain unchanged.

## Security, privacy and external-data impact

- Lifecycle execution increases install-time supply-chain exposure.
- Exposure is limited to one exact runtime package and lockfile-resolved content.
- `esbuild` and all unlisted packages remain denied.
- Installation handles no campaign data or secrets.
- Frozen install and `pnpm audit --audit-level high` remain mandatory.

## Required tests and operational evidence

- `pnpm ignored-builds` lists `esbuild`, not `better-sqlite3`.
- A fresh copy without `node_modules` or `dist` passes frozen install.
- A smoke test opens and closes an in-memory native database.
- Full local `pnpm check` passes 51/51 tests.
- Ubuntu / Node.js 22.13.0 CI passes on the updated PR head.
- High-severity audit passes and migrations `0000`–`0002` remain unchanged.

## Consequences and trade-offs

- The native driver becomes portable across clean supported environments.
- Install may take longer or require a compiler without a prebuilt binary.
- The project accepts a narrowly scoped lifecycle-script risk.
- CI tests the same install path expected for fresh local setups.

## Rejected alternatives

Concurrency changes, vendored binaries, driver replacement and CI-only compilation are rejected for the reasons above.

## Unresolved questions

None blocking. A new unsupported-platform failure must be reported rather than silently changing drivers.

## Approval record

- Approved by the repository owner in the Codex task on 2026-08-26.
- Approval scope: the complete ADR-0016 proposal without requested changes.

## Change log

- 2026-08-26 — Proposed after two reproducible GitHub Actions failures exposed the disproved ADR-0012 installation assumption.
- 2026-08-26 — Accepted after explicit repository-owner approval.
- 2026-08-26 — Recorded implementation evidence that the pinned package uses implicit `node-gyp rebuild`; documented the native toolchain prerequisite.
