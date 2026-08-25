# BG3 Campaign Agent

Persistent local-first Baldur's Gate 3 campaign manager with AI-assisted build, equipment, spell and item analysis.

This starter repository is specification-first. Implementation is intentionally staged through `ROADMAP.md`.

## Start here

1. Read `SPECIFICATION.md`.
2. Read `AGENTS.md`.
3. Follow `ROADMAP.md` milestone by milestone.
4. Use prompts under `prompts/milestones/` when delegating implementation to Codex.

## Canonical state

The final application will use SQLite as the only writable source of truth. XLSX/JSON are exports, not writable authorities.

## Current repository contents

This starter contains product/architecture documentation, ADRs, JSON schemas, example tool-call JSONL, regression scenarios, and ready-to-run implementation prompts. Application code is intentionally not implemented yet.
