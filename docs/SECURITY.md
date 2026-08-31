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
  for one versioned result document. Errors raised while closing an opened M3
  application are contained by the same mapping boundary and cannot expose a stack trace
  or replace an earlier command failure.
- CLI exports require an explicit local target and refuse overwrite unless the operator
  supplies `--overwrite`. The database, filesystem aliases and SQLite companion paths
  remain protected even with that flag. The public M3 export capability enforces the
  same target policy for non-CLI consumers and anchors protected resolved/canonical
  paths plus the database and existing SQLite-companion file identities when the
  application opens, so renaming a protected file does not make its new path exportable.
  Each output target is likewise resolved once through its canonical existing parent
  directory before policy evaluation and asynchronous serialization. The parent
  device/inode is retained and revalidated before temporary-file creation and
  immediately before final publication, so replacing the checked directory with a
  symlink or junction fails closed. Exported campaign state remains private local data.
- M3 compares the campaign's full sorted `sqlite_schema` manifest with an isolated
  in-memory schema built from the committed migration bundle. Missing/changed columns,
  indexes or other schema objects fail closed without modifying campaign state.
