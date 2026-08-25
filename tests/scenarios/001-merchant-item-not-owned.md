# Scenario 001 — Merchant item remains unowned

Given Łuk Tytana is described as merchant stock and is not already owned.

When user asks whether it is worth buying.

Then agent may research and recommend it.

And no inventory item is created.

Only after user says they bought it may an owned instance be created.
