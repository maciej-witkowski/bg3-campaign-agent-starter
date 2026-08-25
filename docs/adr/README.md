# Architecture Decision Records

Format: `NNNN-short-title.md`.

Each ADR contains: status, context, decision, consequences and supersession notes.

## Convention

1. Copy the structure of an existing ADR and assign the next four-digit number.
2. Use a short lowercase kebab-case title in the filename.
3. Set status to `Proposed`, `Accepted`, `Superseded` or `Rejected`.
4. Record the context and trade-offs, not only the selected technology.
5. Never rewrite an accepted decision to hide a later change. Add a new ADR and link the superseded record in both files.

ADRs are plain Markdown and require no generator. Review them in the same pull request as the implementation they govern.
