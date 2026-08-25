# Prompt Index

## Implementation

Use exactly one matching file under `milestones/`:

- M0 `M0-foundation.md`
- M1 `M1-database.md`
- M2 `M2-import.md`
- M3 `M3-cli.md`
- M4 `M4-tools.md`
- M5 `M5-agent-readonly.md`
- M6 `M6-controlled-mutations.md`
- M7 `M7-item-resolver.md`
- M8 `M8-research.md`
- M9 `M9-merchant.md`
- M10 `M10-levelup.md`
- M11 `M11-voice.md`
- M12 `M12-desktop.md`
- M13 `M13-vision.md`
- M14 `M14-synergy.md`
- M15 `M15-reliability.md`

## Quality tasks

- `review-milestone.md` — independent architecture/state-correctness review.
- `bugfix-regression.md` — reproduce production bug, add regression, then fix.

## Runtime prompt

- `system.md` — baseline campaign agent behavior. Keep actual campaign state out of this file; retrieve it through tools.
