# Voice Architecture

## Initial mode
Push-to-talk only. Wake-word mode is deferred.

## Recommended interaction

1. user holds configurable hotkey;
2. audio streamed to Realtime API;
3. final transcript is displayed locally;
4. intent router classifies request;
5. tools/reasoning run;
6. response is displayed and optionally spoken;
7. mutations require explicit confirmation semantics.

## Voice mutation safety

Partial transcripts never mutate campaign state.
Only final recognized utterances can be considered for confirmation.

The UI should visibly show a mutation preview before/while applying it.

## Privacy
Raw audio should not be persisted by default. Store text transcript and tool/audit metadata only unless user opts in.

## Offline behavior
If realtime is unavailable, the rest of the app remains functional through CLI/text.
