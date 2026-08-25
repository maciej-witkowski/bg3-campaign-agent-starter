# Decision Protocol

## States

### ANALYZE
User requests comparison/advice. No mutation.

### PROPOSE
Agent creates a structured proposal with an ID and human-readable summary.

### CONFIRM
User explicitly accepts proposal or states the real-world game change already occurred.

### COMMIT
Domain service performs transaction, validates, writes audit event and snapshot.

### REPORT
Agent states exactly what changed.

## Example

User: "Czy Ryzykowny Pierścień będzie lepszy dla Lae'zel?"

Agent: analyzes and creates proposal `P123`: replace X with Risky Ring.
No DB write.

User: "Tak, zatwierdzam."

Resolver maps confirmation to P123. `equip_item()` commits. Audit event stores before/after.

## Direct fact

User: "Kupiłem Talizman Zamykania Ran i wkładam go do skrzyni."

No proposal is necessary if interpretation is unambiguous. `add_owned_item()` may run with direct-fact confirmation metadata.

## Ambiguity

"Dobra, zróbmy tak" when multiple proposals are open must not mutate. Ask which proposal or resolve only if dialogue state unambiguously contains one current proposal.
