import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import process from "node:process";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { spawnSync } from "node:child_process";

import ExcelJS from "exceljs";

import { CAMPAIGN_XLSX_VERSION, openM2CampaignApplication } from "../dist/index.js";
import { openMigratedSqliteConnection } from "../dist/persistence/sqlite/migrations.js";

if (CAMPAIGN_XLSX_VERSION !== 1 || typeof ExcelJS.Workbook !== "function") {
  throw new Error("Production XLSX module interop is invalid.");
}

const application = openM2CampaignApplication({ filename: ":memory:" });
application.close();

const directory = mkdtempSync(join(tmpdir(), "bg3-production-cli-"));
try {
  const databasePath = join(directory, "campaign.sqlite");
  const exportPath = join(directory, "campaign.json");
  seedCampaign(databasePath);
  const before = sha256(databasePath);
  const commands = [
    ["party"],
    ["character", "Lae'zel"],
    ["equipment", "Lae'zel"],
    ["inventory", "--slot", "RING", "--status", "EQUIPPED", "--tag", "BONUS"],
    ["spells", "Lae'zel"],
    ["illithid", "Lae'zel"],
    ["changes", "--limit", "1"],
    ["validate"],
    ["export", "--format", "json", "--output", exportPath],
  ];
  for (const command of commands) {
    const result = runCli(databasePath, command);
    if (result.status !== 0 || result.stderr !== "") {
      throw new Error(
        `Production CLI failed for ${command[0]}: status=${result.status}, stderr=${result.stderr}`,
      );
    }
    const parsed = JSON.parse(result.stdout);
    if (parsed.format !== "BG3_CLI_RESULT" || parsed.version !== 1 || parsed.ok !== true) {
      throw new Error(`Production CLI returned an invalid envelope for ${command[0]}.`);
    }
  }
  for (const protectedPath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    const rejected = runCli(databasePath, [
      "export",
      "--format",
      "json",
      "--output",
      protectedPath,
      "--overwrite",
    ]);
    const parsed = JSON.parse(rejected.stdout);
    if (
      rejected.status !== 5 ||
      parsed.ok !== false ||
      parsed.error?.code !== "ARTIFACT_WRITE_FAILED"
    ) {
      throw new Error(`Production CLI accepted protected export target: ${protectedPath}.`);
    }
  }
  if (sha256(databasePath) !== before) {
    throw new Error("Production CLI changed canonical SQLite bytes.");
  }
  const exported = JSON.parse(readFileSync(exportPath, "utf8"));
  if (exported.format !== "BG3_CAMPAIGN_EXPORT" || exported.version !== 1) {
    throw new Error("Production CLI export artifact is invalid.");
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function runCli(databasePath, command) {
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../dist/cli/main.js", import.meta.url)),
      "--db",
      databasePath,
      "--json",
      ...command,
    ],
    { encoding: "utf8", windowsHide: true },
  );
}

function sha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function seedCampaign(filename) {
  const connection = openMigratedSqliteConnection({ filename });
  try {
    const client = connection.database.$client;
    const instant = "2026-08-30T12:00:00.000Z";
    client
      .prepare(
        "insert into characters (id, canonical_name, display_name_pl, race_pl, class_pl, subclass_pl, level, role_summary, active_party, notes, created_at, updated_at) values (?, ?, ?, null, ?, null, 8, ?, 1, null, ?, ?)",
      )
      .run("character-1", "laezel", "Lae'zel", "Wojowniczka", "Pierwsza linia", instant, instant);
    client
      .prepare(
        "insert into character_attributes (character_id, attribute, base_value) values (?, 'STR', 17)",
      )
      .run("character-1");
    client
      .prepare(
        "insert into item_definitions (id, name_pl, normalized_name_pl, name_en, type_pl, slot, rarity_pl, description_pl, verification_status, verification_confidence, verification_source, fingerprint, notes) values (?, ?, ?, null, null, 'RING', null, null, 'VERIFIED', null, null, null, null)",
      )
      .run("definition-1", "Pierścień Próby", "pierścień próby");
    client
      .prepare(
        "insert into item_effects (id, item_definition_id, effect_type, numeric_value, dice_expression, damage_type, trigger, condition_text_pl, duration_text_pl, description_pl, verification_status) values (?, ?, 'BONUS', null, null, null, null, null, null, ?, 'VERIFIED')",
      )
      .run("effect-1", "definition-1", "Premia testowa");
    client
      .prepare(
        "insert into inventory_items (id, item_definition_id, status, owner_character_id, quantity, obtained_at, obtained_location, notes) values (?, ?, 'EQUIPPED', ?, 1, null, null, null)",
      )
      .run("inventory-1", "definition-1", "character-1");
    client
      .prepare(
        "insert into equipment (inventory_item_id, character_id, slot) values (?, ?, 'RING_1')",
      )
      .run("inventory-1", "character-1");
    client
      .prepare(
        "insert into spells (id, name_pl, normalized_name_pl, name_en, level, school_pl, description_pl, verification_status, notes) values (?, ?, ?, null, 0, null, null, 'VERIFIED', null)",
      )
      .run("spell-1", "Światło", "światło");
    client
      .prepare(
        "insert into character_spells (character_id, spell_id, source, known, prepared, always_prepared, notes) values (?, ?, 'RACE', 1, 0, 0, null)",
      )
      .run("character-1", "spell-1");
    client
      .prepare(
        "insert into illithid_powers (id, name_pl, normalized_name_pl, name_en, tier, description_pl, verification_status, notes) values (?, ?, ?, null, 1, null, 'VERIFIED', null)",
      )
      .run("power-1", "Skupiony Wybuch", "skupiony wybuch");
    client
      .prepare(
        "insert into character_illithid_powers (character_id, power_id, acquired_at, acquisition_source_pl, notes) values (?, ?, null, 'WYKUPIONA', null)",
      )
      .run("character-1", "power-1");
    client
      .prepare(
        "insert into change_events (id, occurred_at, type, character_id, checkpoint_id, proposal_id, summary_pl, reason_pl, before_json, after_json, reverses_change_event_id) values (?, ?, 'TEST', ?, null, null, ?, null, '{}', '{}', null)",
      )
      .run("event-1", instant, "character-1", "Stan testowy");
  } finally {
    connection.close();
  }
}
