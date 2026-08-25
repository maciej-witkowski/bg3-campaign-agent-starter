# Scenario 005 — Permanent modifier provenance survives respec

Lae'zel base STR 20 with +2 permanent potion modifier.

When base attributes are respeced and later returned to 20.

Expected:
- modifier record remains independent;
- effective STR recomputes from new base + modifier;
- source remains Mikstura Wiecznego Wigoru.
