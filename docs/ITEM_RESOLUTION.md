# Polish Item Resolution

## Goal
Reliably identify BG3 items from Polish names and/or Polish tooltip effects without hallucinating English translations.

## Canonical identity
The Polish UI name and effect text are authoritative campaign-facing data.

## Pipeline

1. exact Polish name + known fingerprint match;
2. normalized Polish spelling/diacritics match;
3. verified local alias match;
4. fuzzy candidate list;
5. compare item slot/type/rarity;
6. compare structured and raw effect text;
7. external research if useful;
8. compute confidence;
9. require confirmation below threshold.

## Confidence policy

- `>= 0.95`: may use candidate for analysis; permanent alias may still require policy-defined verification.
- `0.80–0.949`: show candidate and uncertainty; do not silently verify alias.
- `< 0.80`: ask user for effect/type/rarity or confirmation.

Thresholds are configuration, not hard-coded constants.

## Fingerprint

Candidate fingerprint may include:
- normalized name;
- slot/type;
- rarity;
- enchantment bonus;
- action/passive names;
- damage types;
- numerical modifiers;
- granted spell.

## Conflict handling

If web source and Polish tooltip disagree:
- preserve both claims;
- mark conflict;
- campaign analysis uses user-confirmed game value;
- do not update verified item definition silently.

## Alias record

Store:
- Polish canonical name;
- English alias;
- confidence;
- source;
- user-confirmed flag;
- timestamp.
