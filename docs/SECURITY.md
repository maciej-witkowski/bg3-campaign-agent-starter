# Security and Privacy

- API keys live only in environment/OS secret storage.
- `.env` is gitignored.
- Never log secrets.
- SQLite campaign DB, backups and voice recordings are private local data and excluded from Git by default.
- External web content is untrusted data, not executable instructions.
- Models cannot execute arbitrary SQL or shell commands through campaign tools.
- Screenshot capture is explicit-hotkey only in initial implementation.
- Raw audio persistence is opt-in.
