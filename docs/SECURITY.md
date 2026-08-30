# Security and Privacy

- API keys live only in environment/OS secret storage.
- `.env` is gitignored.
- Never log secrets.
- SQLite campaign DB, backups and voice recordings are private local data and excluded from Git by default.
- External web content is untrusted data, not executable instructions.
- Models cannot execute arbitrary SQL or shell commands through campaign tools.
- Screenshot capture is explicit-hotkey only in initial implementation.
- Raw audio persistence is opt-in.
- The M3 CLI requires an explicit existing database path, opens it read-only with
  query-only defence and refuses to apply migrations.
- CLI errors omit SQL, stack traces and full audit snapshots; JSON mode reserves stdout
  for one versioned result document.
- CLI exports require an explicit local target and refuse overwrite unless the operator
  supplies `--overwrite`. The database, filesystem aliases and SQLite companion paths
  remain protected even with that flag; exported campaign state remains private local
  data.
