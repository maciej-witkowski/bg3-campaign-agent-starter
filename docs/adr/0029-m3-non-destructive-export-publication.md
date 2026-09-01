# ADR-0029: Non-destructive M3 export publication

Status: Proposed

Milestone: M3 — Read-Only CLI

Supersession: If accepted, this ADR partially supersedes the existing-target overwrite
decisions in ADR-0026 and ADR-0028. It does not change M2 import/export behavior.

## Context and problem statement

M3 export currently accepts `--overwrite` and reuses the M2 atomic artifact writer. The
writer serializes and verifies a temporary artifact, checks the protected database file
identity, and then renames the temporary file over the target. A separate process can
move the open campaign database onto that target after the final identity check but
before the rename reaches the filesystem. The rename then removes the database's only
directory entry.

Node 22 exposes atomic rename and fail-if-present hard-link operations, but no portable
compare-and-swap replacement conditioned on the current target inode. Repeating a
filesystem identity check narrows but cannot close the check/use interval. In-place
writes through an opened descriptor preserve inode identity but abandon atomic artifact
publication. Native platform APIs or a retained backup protocol would add dependencies,
platform differences or new artifact lifecycle semantics.

## Decision drivers and invariants

- SQLite campaign state must remain safer than export convenience.
- M3 must not destructively replace an unchecked filesystem identity.
- Verified artifacts must become visible atomically or publication must fail.
- Public M3 library consumers must receive the same protection as CLI consumers.
- The solution must remain portable across supported Node platforms without a native
  runtime dependency.
- M2 behavior must not be changed as an incidental part of M3 remediation.
- Existing targets and race-created targets must remain byte-identical after refusal.

## Considered options

### Option A — Make M3 export creation-only

Remove `--overwrite` from M3 grammar. Configure the public M3 export capability to reject
an overwrite request and always publish with the writer's fail-if-present hard-link path.
An existing target or a target that appears during export causes a typed failure without
replacing or unlinking it.

### Option B — Keep repeated check followed by overwrite rename

This retains convenience but leaves an unavoidable operation boundary between checking
the target inode and replacing its pathname.

### Option C — Write through an opened target descriptor

This binds writes to the inspected inode but makes an overwrite non-atomic. Readers may
observe a truncated or partial artifact after a crash.

### Option D — Add a native conditional-replace implementation

Platform-specific APIs could approach compare-and-swap semantics, but require a native
dependency, separate Windows/POSIX behavior and a substantially larger security surface.

### Option E — Move the previous target to a retained backup

This can avoid immediate data loss, but creates unrequested private sidecars, requires a
backup naming/retention contract and still needs safe cleanup semantics.

## Proposed decision and rationale

Select Option A.

M3 exports are creation-only. The CLI no longer accepts `--overwrite`; an existing
target must be removed or renamed explicitly by the operator before invoking export.
The public M3 composition supplies a no-overwrite policy to `CampaignExportService`, so
direct consumers cannot restore destructive replacement by passing
`{ overwrite: true }`.

The generic M2 export service and atomic writer retain their existing overwrite option
for M2 callers; this ADR changes only the M3 composition and CLI contract. Within M3 the
writer always uses fail-if-present hard-link publication. If any file appears at the
target after the final guard, the link fails with `EEXIST` and neither file is changed.

This deliberately trades convenience and backward compatibility within the unreleased
M3 branch for a portable, enforceable no-canonical-data-loss guarantee.

## Boundaries and dependency direction

- ADR-0026 target policy declares that overwrite is forbidden for the M3 capability.
- `CampaignExportService` enforces a supplied policy before selecting writer options.
- ADR-0028 parser and command types omit `--overwrite` for M3.
- The atomic writer remains an application utility and uses fail-if-present publication
  when overwrite is false.
- No adapter, UI or model can bypass the M3 policy through the exported composition.
- No native filesystem package or platform-specific branch is introduced.

## Data, migration and compatibility impact

- No SQLite schema, migration or campaign data changes are required.
- JSON and XLSX artifact formats remain unchanged.
- M2 library overwrite behavior remains unchanged.
- The unreleased M3 CLI grammar changes: `--overwrite` becomes an invalid option.
- Scripts must explicitly remove or rename an old export artifact before creating a new
  one. That external filesystem action is outside the read-only CLI.

## Transaction, validation, audit and rollback impact

- Campaign transactions, validation, audit events and checkpoints are unchanged.
- Export remains a non-campaign mutation and creates no audit event.
- A failed publication removes only its private temporary artifact.
- Existing target bytes and protected SQLite identities must remain unchanged.
- Rollback is removal of the M3 no-overwrite policy and parser restriction; no data
  migration is needed.

## Security, privacy and external-data impact

- M3 never unlinks or replaces an existing output pathname.
- A protected database moved onto the target at any point remains intact because final
  publication uses a create-if-absent operation.
- No backup copies of private exports or campaign databases are created.
- Error messages remain bounded and do not reveal artifact or database contents.

## Required tests and operational evidence

- Parser tests reject `--overwrite` for M3 export before opening the database.
- Direct M3 composition tests reject `{ overwrite: true }` even for a distinct target.
- Existing-target tests prove both JSON and XLSX files remain byte-identical.
- Race regressions move the protected database onto the target during serialization,
  verification and immediately before create-if-absent publication; all fail safely.
- Generic M2 writer tests prove its separately scoped overwrite behavior is unchanged.
- Production smoke covers the revised grammar and existing-target refusal.
- Full `pnpm check`, high-severity audit, scope sweep, CI/security and current-head Codex
  review pass before M3 is handed to a human.

## Consequences and trade-offs

- M3 gains a simple portable invariant: it creates a new artifact or changes nothing.
- Repeated exports require an explicit operator-managed rename/removal step.
- Existing automation using the unreleased `--overwrite` flag must be updated.
- M2 and M3 export replacement semantics intentionally differ because M3's read-only
  boundary gives canonical-state safety priority over convenience.

## Rejected alternatives

- Status-quo rename overwrite is rejected because repeated checks cannot make separate
  filesystem operations atomic.
- In-place descriptor writes are rejected because they violate atomic publication.
- A native conditional-replace dependency is rejected for M3 portability and scope.
- Automatic backup retention is rejected because it creates unrequested private files
  and a new cleanup contract.
- Treating the race as too small is rejected because canonical campaign loss is the
  highest-severity failure for this project.

## Unresolved questions

None blocking. A future milestone may propose a platform-specific safe replacement
facility, but it must use a new ADR and cannot weaken M3's creation-only default.

## Approval record

- Proposed after Codex review of `5f6e83c` on 2026-09-01.
- Awaiting explicit repository-owner approval.

## Change log

- 2026-09-01 — Initial proposal after review identified the remaining non-atomic
  protected-target check/overwrite interval.
