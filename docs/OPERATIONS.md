# Operations

## Backups
Recommended rotation:
- backup at application start;
- last 10 launch backups;
- daily backups for 14 days;
- named major checkpoints retained indefinitely.

## Exports
Support JSON and XLSX exports. Exports are read-only views and never become canonical writable state.

M3 command examples:

```sh
pnpm cli -- --db campaign/current.sqlite export --format json --output campaign/exports/state.json
pnpm cli -- --db campaign/current.sqlite export --format xlsx --output campaign/exports/state.xlsx
```

Existing targets are refused unless `--overwrite` is explicit. Export validates one
consistent current-state snapshot and creates no audit event or checkpoint.

## Recovery
M3 provides read-only validation:

```sh
pnpm cli -- --db campaign/current.sqlite validate
```

The CLI returns exit 4 when violations are present and never repairs them. Checkpoint
listing, restore into a new file, comparison and explicit active-database replacement
remain M16 scope.

## Diagnostics
A support bundle may include schema version, app logs, validation output and redacted state summary, but never API keys.
