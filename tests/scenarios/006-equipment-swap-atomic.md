# Scenario 006 — Equipment swap is atomic

Given candidate is in CHEST and current slot has an equipped item.

When confirmed equip mutation runs.

Expected:
- candidate becomes EQUIPPED;
- previous item moves to requested destination;
- no intermediate contradictory state persists;
- one audit event exists;
- invariant validation passes.
