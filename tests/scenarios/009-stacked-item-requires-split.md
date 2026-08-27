# Scenario 009 — A stacked item requires an explicit split before equipping

Given an inventory row in CHEST has quantity greater than one.

When a confirmed equipment mutation attempts to mark that row as EQUIPPED and assign a slot.

Expected:
- campaign validation reports `EQUIPPED_QUANTITY_INVALID`;
- inventory status, owner, quantity and location remain unchanged;
- no equipment assignment persists;
- no audit event is created;
- the stack is not silently split, reduced or duplicated.
