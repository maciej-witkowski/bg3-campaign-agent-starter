# Operations

## Backups
Recommended rotation:
- backup at application start;
- last 10 launch backups;
- daily backups for 14 days;
- named major checkpoints retained indefinitely.

## Exports
Support JSON and XLSX exports. Exports are read-only views and never become canonical writable state.

## Recovery
Provide CLI commands to:
- validate DB;
- list checkpoints;
- restore checkpoint into a new DB file first;
- compare current versus restored state;
- explicitly replace active DB only after validation.

## Diagnostics
A support bundle may include schema version, app logs, validation output and redacted state summary, but never API keys.
