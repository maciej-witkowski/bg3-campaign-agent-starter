# Scenario 003 — Same Polish name, distinct item variants

Database contains two `Hełm Mrocznego Sędziego` definitions with different rarity/effects.

User gives only the shared Polish name.

Expected:
- resolver returns ambiguity;
- asks for rarity/effect;
- does not select variant automatically.
