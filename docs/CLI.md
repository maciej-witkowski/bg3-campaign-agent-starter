# Read-Only CLI

M3 provides local campaign inspection without AI. Build the project before using the
production entry point:

```sh
pnpm build
pnpm cli -- --help
```

The installed executable name is `bg3-campaign`. Repository examples use
`pnpm cli --` to invoke the same built `dist/cli/main.js` entry.

## Safety model

- Every data command requires `--db <path>` pointing to an existing file.
- The database must already have exactly the latest schema supported by this build.
- The CLI opens SQLite in driver read-only and query-only modes and never applies
  migrations.
- No command creates an audit event or checkpoint.
- `export` writes only its explicit output file; SQLite remains unchanged.
- No command uses AI, web research, fuzzy name resolution or mutation tools.

SQLite databases and exports contain private campaign state. Keep them outside source
control; the repository ignore rules cover common database extensions and
`campaign/exports/` artifacts.

## Commands

```text
bg3-campaign --db <path> [--json] party
bg3-campaign --db <path> [--json] character <name>
bg3-campaign --db <path> [--json] equipment <name>
bg3-campaign --db <path> [--json] inventory [--slot <slot>]... [--status <status>]... [--tag <tag>]...
bg3-campaign --db <path> [--json] spells <name>
bg3-campaign --db <path> [--json] illithid [name]
bg3-campaign --db <path> [--json] changes [--limit <1-1000>]
bg3-campaign --db <path> [--json] validate
bg3-campaign --db <path> [--json] export --format <json|xlsx> --output <path> [--overwrite]
```

Quote character names containing spaces or shell-significant punctuation.

`party` returns active characters and effective attributes. `character` returns the
profile, attributes, permanent modifiers and assigned abilities. Equipment, spells and
illithid state use their dedicated commands rather than expanding the character result.

Character lookup first tries an exact case-sensitive canonical name. Otherwise it uses
conservative NFC, whitespace and Polish-lowercase matching against the display name.
Zero or multiple matches fail explicitly; M3 does not perform fuzzy or alias matching.

## Inventory filters

`--slot`, `--status` and `--tag` are repeatable. Values within one category combine with
OR; different categories combine with AND.

Slots and statuses use the uppercase domain values documented in `docs/DATA_MODEL.md`.
An M3 tag is deliberately narrow: it exactly matches a normalized stored
`item_effects.effect_type`, `damage_type` or `trigger`. Description/condition prose is
not searched and no M14 synergy tag is inferred.

Example:

```sh
pnpm cli -- --db campaign/current.sqlite inventory --slot RING --slot NECK --status CHEST --tag PROMIENNE
```

## JSON contract

`--json` emits exactly one `BG3_CLI_RESULT` V1 document plus a trailing newline on
stdout. Success:

```json
{
  "format": "BG3_CLI_RESULT",
  "version": 1,
  "command": "party",
  "ok": true,
  "data": {},
  "warnings": []
}
```

Failure:

```json
{
  "format": "BG3_CLI_RESULT",
  "version": 1,
  "command": "character",
  "ok": false,
  "error": {
    "code": "CHARACTER_NOT_FOUND",
    "messagePl": "Nie znaleziono postaci.",
    "details": {}
  },
  "warnings": []
}
```

For `export`, the CLI envelope contains bounded artifact metadata. The campaign export
body is written to `--output` using the separately versioned M2 export format.

## Exit statuses

| Status | Meaning |
| --- | --- |
| `0` | Success; for `validate`, campaign state is valid. |
| `1` | Unexpected safely mapped internal failure. |
| `2` | Invalid command arguments or filters. |
| `3` | Character not found or ambiguous. |
| `4` | Database/schema/read failure or reported validation violations. |
| `5` | Export serialization or artifact publication failure. |

Human successes use stdout and human failures use stderr. In JSON mode the one result
document uses stdout; internal logs and stack traces are never mixed into it.
