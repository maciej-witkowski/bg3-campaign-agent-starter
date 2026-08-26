# ADR-0017: Raise the minimum Node.js version for Node-API 10

Status: Proposed

Milestone: M1 — Canonical Campaign Database

Supersedes in part: ADR-0011 minimum Node.js version and ADR-0012 compatibility evidence

## Context and problem statement

M0 established Node.js 22.13.0 as the repository minimum. M1 pinned `better-sqlite3@13.0.3`, whose native addon is built with `NAPI_VERSION=10`. Node.js 22.13.0 predates Node-API 10; the official Node.js 22.14.0 release introduced Node-API version 10.

Four GitHub Actions runs on Ubuntu/Node.js 22.13.0 show the same boundary. Formatting, lint and typecheck pass. The six Vitest workers that load SQLite exit unexpectedly, while all three non-persistence files and 18 tests pass. After accepted ADR-0016 enabled the pinned package lifecycle permission, CI confirmed a successful package installation and prebuild detection, but the runtime failure remained unchanged. This rules out missing installation permission as the remaining cause.

The repository minimum and CI matrix must match the native addon's actual Node-API requirement. Changing the minimum runtime version is a toolchain compatibility decision and requires explicit approval.

## Decision drivers and invariants

- Preserve the accepted SQLite, Drizzle and exactly pinned driver architecture.
- Use a Node.js runtime that supports the addon's declared Node-API version.
- Keep the minimum within the Node.js 22 LTS line.
- CI must test the exact documented minimum.
- Avoid source patching or vendoring third-party native binaries.
- Do not change schemas, migrations, domain behavior or campaign state.
- Keep ADR-0016 lifecycle permission limited to the pinned driver.

## Considered options

### Option A — Raise the minimum to Node.js 22.14.0

Update `package.json`, README, CI and superseded ADR evidence from 22.13.0 to 22.14.0. This is the first Node.js 22 release with Node-API 10 and is the smallest compatible runtime change.

### Option B — Downgrade better-sqlite3

Selecting an older driver built against Node-API 9 could retain Node.js 22.13.0, but changes an accepted, tested runtime dependency and lockfile and requires revalidating driver behavior and advisories.

### Option C — Force-build better-sqlite3 with Node-API 9

This requires patching upstream build definitions or maintaining a fork. It increases native maintenance and diverges from the signed, pinned package.

### Option D — Replace the SQLite driver

Switching to `node:sqlite`, WASM or another adapter would materially replace ADR-0012 and expand M1 far beyond the compatibility correction.

### Option E — Keep Node.js 22.13.0 and serialize Vitest workers

Concurrency changes cannot add Node-API 10 support and are rejected as unrelated.

## Proposed decision and rationale

Raise the repository minimum from Node.js 22.13.0 to Node.js 22.14.0:

- set `package.json#engines.node` to `>=22.14.0`;
- make GitHub Actions install and test exactly Node.js 22.14.0;
- update README and ADR-0011/ADR-0012 compatibility evidence;
- leave dependency versions, lockfile, SQLite schema and all migrations unchanged;
- retain ADR-0016's narrow lifecycle permission for `better-sqlite3`.

Node.js 22.14.0 is the first release in the same LTS major containing Node-API 10, so this directly satisfies the pinned addon's ABI requirement with less change than a dependency downgrade or fork.

## Boundaries and dependency direction

Only the runtime floor and CI environment change. Adapter, domain, repository and persistence boundaries remain unchanged. No SQL or native connection is exposed to higher layers.

## Data, migration and compatibility impact

- No schema or migration changes.
- No canonical campaign data is read or written.
- Existing database files remain compatible.
- Environments on Node.js 22.13.x or earlier must upgrade before installation/runtime.
- Migration hashes `0000` through `0002` must remain unchanged.

## Transaction, validation, audit and rollback impact

None. The runtime correction only permits the existing native driver to load; mutation, validation, audit and checkpoint semantics remain unchanged.

## Security, privacy and external-data impact

- No new dependency, network service or campaign-data access is introduced.
- The minimum runtime receives Node.js fixes newer than 22.13.0.
- Frozen lockfile, high-severity audit and restricted lifecycle permission remain mandatory.
- CI downloads the official Node.js 22.14.0 distribution through the existing setup action.

## Required tests and operational evidence

- CI uses exactly Node.js 22.14.0 and reports Node-API 10.
- A direct CI smoke test opens and closes a `better-sqlite3` in-memory database.
- Fresh Ubuntu frozen install passes.
- Full CI quality gates pass all 9 files and 51 tests, including six persistence files.
- Local Node.js 24 validation continues to pass.
- High-severity dependency audit passes.
- Dependency versions, lockfile and migration hashes remain unchanged.
- Codex review is rerun for the final head.

## Consequences and trade-offs

- Node.js 22.13.x installations are no longer supported.
- The runtime floor advances by one minor LTS release.
- The pinned driver can use its Node-API 10 addon without a fork or dependency change.
- CI becomes an explicit minimum-runtime compatibility test.

## Rejected alternatives

Driver downgrade, upstream patching, driver replacement and test-pool workarounds are rejected for the reasons above.

## Unresolved questions

None blocking. If Node.js 22.14.0 does not pass the direct native smoke test in clean CI, stop and propose a driver-version decision rather than raising the runtime again without evidence.

## Approval record

Awaiting explicit repository-owner approval.

## Change log

- 2026-08-26 — Proposed after current-head CI proved successful native package installation but reproducible runtime failure on Node.js 22.13.0, and official Node.js release evidence identified 22.14.0 as the first Node-API 10 release.
