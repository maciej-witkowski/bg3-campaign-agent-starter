# Domain Rules

## Campaign truth

The canonical database describes what is true now. `change_events` describe how it became true.

## Inventory

- One inventory item has exactly one current status.
- An equipped item has an owner and slot.
- A chest item has no equipped slot.
- A sold item cannot be equipped.
- A personal/story item must not be proposed for sale or redistribution unless the user explicitly allows it.

## Duplicate policy

The initial campaign convention treats identical duplicate items as one catalog entry unless quantity becomes mechanically relevant. Item definitions and inventory instances are separate so the implementation can later track exact quantity without redesign.

## Recommendations

A recommendation must identify:

1. current item/choice;
2. candidate;
3. gained effects;
4. lost effects/opportunity cost;
5. build/party synergy;
6. reliability/conditions;
7. recommendation confidence.

## Mutations

State mutation is allowed when:

- the user explicitly states a fact that already happened ("kupiłem", "założyłem", "wypiłem miksturę"); or
- the user explicitly confirms a known proposal.

Suggestion, speculation and hypothetical wording never count as mutation permission.

## Leveling

Before level-up analysis load current character state. Do not rely on remembered earlier choices when database records exist.

## Merchant sessions

Items described as merchant stock are not owned. They may be researched and compared, but cannot become `CHEST` until purchase is explicitly stated.

## Permanent modifiers

Permanent changes such as +2 STR must store provenance independently from class/base attribute allocation so a future respec cannot erase their source.

## External research

Never overwrite user-confirmed UI effects because a website differs. Record the conflict and explain it.
