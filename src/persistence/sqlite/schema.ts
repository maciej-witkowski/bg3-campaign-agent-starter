import { sql, type SQLWrapper } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  ABILITY_TYPES,
  ATTRIBUTE_KEYS,
  EQUIPMENT_SLOTS,
  INVENTORY_STATUSES,
  ITEM_SLOTS,
  PROVENANCE_TYPES,
  SPELL_SOURCES,
  VERIFICATION_STATUSES,
} from "../../domain/model/campaign.js";

const nonEmpty = (column: SQLWrapper) => sql`length(trim(${column})) > 0`;
const instant = (column: SQLWrapper) =>
  sql`length(${column}) = 24 and ${column} glob '????-??-??T??:??:??.???Z'`;
const sqlList = (values: readonly string[]) =>
  sql.raw("(" + values.map((value) => "'" + value.replaceAll("'", "''") + "'").join(", ") + ")");

export const characters = sqliteTable(
  "characters",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    displayNamePl: text("display_name_pl").notNull(),
    racePl: text("race_pl"),
    classPl: text("class_pl").notNull(),
    subclassPl: text("subclass_pl"),
    level: integer("level").notNull(),
    roleSummary: text("role_summary").notNull(),
    activeParty: integer("active_party", { mode: "boolean" }).notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("characters_canonical_name_unique").on(t.canonicalName),
    check(
      "characters_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.canonicalName)} and ${nonEmpty(t.displayNamePl)} and ${nonEmpty(t.classPl)} and ${nonEmpty(t.roleSummary)}`,
    ),
    check("characters_level_valid", sql`${t.level} between 1 and 20`),
    check("characters_active_party_boolean", sql`${t.activeParty} in (0, 1)`),
    check("characters_instants_valid", sql`${instant(t.createdAt)} and ${instant(t.updatedAt)}`),
  ],
);

export const characterAttributes = sqliteTable(
  "character_attributes",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    attribute: text("attribute", { enum: ATTRIBUTE_KEYS }).notNull(),
    baseValue: integer("base_value").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.attribute] }),
    check(
      "character_attributes_attribute_valid",
      sql`${t.attribute} in ${sqlList(ATTRIBUTE_KEYS)}`,
    ),
    check("character_attributes_base_value_valid", sql`${t.baseValue} between 1 and 30`),
  ],
);

export const itemDefinitions = sqliteTable(
  "item_definitions",
  {
    id: text("id").primaryKey(),
    namePl: text("name_pl").notNull(),
    normalizedNamePl: text("normalized_name_pl").notNull(),
    nameEn: text("name_en"),
    typePl: text("type_pl"),
    slot: text("slot", { enum: ITEM_SLOTS }),
    rarityPl: text("rarity_pl"),
    descriptionPl: text("description_pl"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull(),
    verificationConfidence: real("verification_confidence"),
    verificationSource: text("verification_source"),
    fingerprint: text("fingerprint"),
    notes: text("notes"),
  },
  (t) => [
    index("item_definitions_normalized_name_idx").on(t.normalizedNamePl),
    uniqueIndex("item_definitions_fingerprint_unique").on(t.fingerprint),
    check(
      "item_definitions_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.namePl)} and ${nonEmpty(t.normalizedNamePl)}`,
    ),
    check(
      "item_definitions_slot_valid",
      sql`${t.slot} is null or ${t.slot} in ${sqlList(ITEM_SLOTS)}`,
    ),
    check(
      "item_definitions_status_valid",
      sql`${t.verificationStatus} in ${sqlList(VERIFICATION_STATUSES)}`,
    ),
    check(
      "item_definitions_confidence_valid",
      sql`${t.verificationConfidence} is null or ${t.verificationConfidence} between 0 and 1`,
    ),
    check(
      "item_definitions_fingerprint_valid",
      sql`${t.fingerprint} is null or length(trim(${t.fingerprint})) > 0`,
    ),
  ],
);

export const permanentModifiers = sqliteTable(
  "permanent_modifiers",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["ATTRIBUTE"] as const }).notNull(),
    targetKey: text("target_key", { enum: ATTRIBUTE_KEYS }).notNull(),
    modifier: integer("modifier").notNull(),
    sourceNamePl: text("source_name_pl").notNull(),
    sourceItemDefinitionId: text("source_item_definition_id").references(() => itemDefinitions.id, {
      onDelete: "restrict",
    }),
    provenanceType: text("provenance_type", { enum: PROVENANCE_TYPES }).notNull(),
    permanent: integer("permanent", { mode: "boolean" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("permanent_modifiers_character_idx").on(t.characterId),
    check(
      "permanent_modifiers_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.sourceNamePl)}`,
    ),
    check(
      "permanent_modifiers_target_valid",
      sql`${t.targetType} = 'ATTRIBUTE' and ${t.targetKey} in ${sqlList(ATTRIBUTE_KEYS)}`,
    ),
    check("permanent_modifiers_value_valid", sql`${t.modifier} between -30 and 30`),
    check(
      "permanent_modifiers_provenance_valid",
      sql`${t.provenanceType} in ${sqlList(PROVENANCE_TYPES)}`,
    ),
    check(
      "permanent_modifiers_booleans_valid",
      sql`${t.permanent} in (0, 1) and ${t.active} in (0, 1)`,
    ),
    check("permanent_modifiers_created_at_valid", instant(t.createdAt)),
  ],
);

export const itemEffects = sqliteTable(
  "item_effects",
  {
    id: text("id").primaryKey(),
    itemDefinitionId: text("item_definition_id")
      .notNull()
      .references(() => itemDefinitions.id, { onDelete: "cascade" }),
    effectType: text("effect_type").notNull(),
    numericValue: real("numeric_value"),
    diceExpression: text("dice_expression"),
    damageType: text("damage_type"),
    trigger: text("trigger"),
    conditionTextPl: text("condition_text_pl"),
    durationTextPl: text("duration_text_pl"),
    descriptionPl: text("description_pl").notNull(),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull(),
  },
  (t) => [
    index("item_effects_definition_idx").on(t.itemDefinitionId),
    check(
      "item_effects_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.effectType)} and ${nonEmpty(t.descriptionPl)}`,
    ),
    check(
      "item_effects_status_valid",
      sql`${t.verificationStatus} in ${sqlList(VERIFICATION_STATUSES)}`,
    ),
  ],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    itemDefinitionId: text("item_definition_id")
      .notNull()
      .references(() => itemDefinitions.id, { onDelete: "restrict" }),
    status: text("status", { enum: INVENTORY_STATUSES }).notNull(),
    ownerCharacterId: text("owner_character_id").references(() => characters.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull().default(1),
    obtainedAt: text("obtained_at"),
    obtainedLocation: text("obtained_location"),
    notes: text("notes"),
  },
  (t) => [
    index("inventory_items_definition_idx").on(t.itemDefinitionId),
    index("inventory_items_owner_idx").on(t.ownerCharacterId),
    index("inventory_items_status_idx").on(t.status),
    check("inventory_items_id_valid", nonEmpty(t.id)),
    check("inventory_items_status_valid", sql`${t.status} in ${sqlList(INVENTORY_STATUSES)}`),
    check("inventory_items_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "inventory_items_obtained_at_valid",
      sql`${t.obtainedAt} is null or ${instant(t.obtainedAt)}`,
    ),
  ],
);

export const equipment = sqliteTable(
  "equipment",
  {
    inventoryItemId: text("inventory_item_id")
      .primaryKey()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    slot: text("slot", { enum: EQUIPMENT_SLOTS }).notNull(),
  },
  (t) => [
    uniqueIndex("equipment_character_slot_unique").on(t.characterId, t.slot),
    check("equipment_slot_valid", sql`${t.slot} in ${sqlList(EQUIPMENT_SLOTS)}`),
  ],
);

export const spells = sqliteTable(
  "spells",
  {
    id: text("id").primaryKey(),
    namePl: text("name_pl").notNull(),
    normalizedNamePl: text("normalized_name_pl").notNull(),
    nameEn: text("name_en"),
    level: integer("level").notNull(),
    schoolPl: text("school_pl"),
    descriptionPl: text("description_pl"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("spells_normalized_name_idx").on(t.normalizedNamePl),
    check(
      "spells_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.namePl)} and ${nonEmpty(t.normalizedNamePl)}`,
    ),
    check("spells_level_valid", sql`${t.level} between 0 and 9`),
    check("spells_status_valid", sql`${t.verificationStatus} in ${sqlList(VERIFICATION_STATUSES)}`),
  ],
);

export const characterSpells = sqliteTable(
  "character_spells",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    spellId: text("spell_id")
      .notNull()
      .references(() => spells.id, { onDelete: "cascade" }),
    source: text("source", { enum: SPELL_SOURCES }).notNull(),
    known: integer("known", { mode: "boolean" }).notNull(),
    prepared: integer("prepared", { mode: "boolean" }).notNull(),
    alwaysPrepared: integer("always_prepared", { mode: "boolean" }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.spellId, t.source] }),
    check("character_spells_source_valid", sql`${t.source} in ${sqlList(SPELL_SOURCES)}`),
    check(
      "character_spells_booleans_valid",
      sql`${t.known} in (0, 1) and ${t.prepared} in (0, 1) and ${t.alwaysPrepared} in (0, 1)`,
    ),
  ],
);

export const abilities = sqliteTable(
  "abilities",
  {
    id: text("id").primaryKey(),
    namePl: text("name_pl").notNull(),
    normalizedNamePl: text("normalized_name_pl").notNull(),
    nameEn: text("name_en"),
    type: text("type", { enum: ABILITY_TYPES }).notNull(),
    descriptionPl: text("description_pl"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("abilities_normalized_name_idx").on(t.normalizedNamePl),
    check(
      "abilities_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.namePl)} and ${nonEmpty(t.normalizedNamePl)}`,
    ),
    check("abilities_type_valid", sql`${t.type} in ${sqlList(ABILITY_TYPES)}`),
    check(
      "abilities_status_valid",
      sql`${t.verificationStatus} in ${sqlList(VERIFICATION_STATUSES)}`,
    ),
  ],
);

export const characterAbilities = sqliteTable(
  "character_abilities",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    abilityId: text("ability_id")
      .notNull()
      .references(() => abilities.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    levelAcquired: integer("level_acquired"),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.abilityId, t.source] }),
    check("character_abilities_source_valid", nonEmpty(t.source)),
    check(
      "character_abilities_level_valid",
      sql`${t.levelAcquired} is null or ${t.levelAcquired} between 1 and 20`,
    ),
  ],
);

export const illithidPowers = sqliteTable(
  "illithid_powers",
  {
    id: text("id").primaryKey(),
    namePl: text("name_pl").notNull(),
    normalizedNamePl: text("normalized_name_pl").notNull(),
    nameEn: text("name_en"),
    tier: integer("tier"),
    descriptionPl: text("description_pl"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES }).notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("illithid_powers_normalized_name_idx").on(t.normalizedNamePl),
    check(
      "illithid_powers_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.namePl)} and ${nonEmpty(t.normalizedNamePl)}`,
    ),
    check("illithid_powers_tier_valid", sql`${t.tier} is null or ${t.tier} between 1 and 10`),
    check(
      "illithid_powers_status_valid",
      sql`${t.verificationStatus} in ${sqlList(VERIFICATION_STATUSES)}`,
    ),
  ],
);

export const illithidPowerPrerequisites = sqliteTable(
  "illithid_power_prerequisites",
  {
    powerId: text("power_id")
      .notNull()
      .references(() => illithidPowers.id, { onDelete: "cascade" }),
    prerequisitePowerId: text("prerequisite_power_id")
      .notNull()
      .references(() => illithidPowers.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.powerId, t.prerequisitePowerId] }),
    check("illithid_power_prerequisites_not_self", sql`${t.powerId} <> ${t.prerequisitePowerId}`),
  ],
);

export const characterIllithidPowers = sqliteTable(
  "character_illithid_powers",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    powerId: text("power_id")
      .notNull()
      .references(() => illithidPowers.id, { onDelete: "cascade" }),
    acquiredAt: text("acquired_at"),
    acquisitionSourcePl: text("acquisition_source_pl"),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.powerId] }),
    check(
      "character_illithid_powers_acquired_at_valid",
      sql`${t.acquiredAt} is null or ${instant(t.acquiredAt)}`,
    ),
  ],
);

export const changeEvents = sqliteTable(
  "change_events",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    type: text("type").notNull(),
    characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
    proposalId: text("proposal_id"),
    summaryPl: text("summary_pl").notNull(),
    reasonPl: text("reason_pl"),
    beforeJson: text("before_json").notNull(),
    afterJson: text("after_json").notNull(),
    reversesChangeEventId: text("reverses_change_event_id"),
  },
  (t) => [
    index("change_events_occurred_at_idx").on(t.occurredAt),
    index("change_events_character_idx").on(t.characterId),
    uniqueIndex("change_events_reverses_unique").on(t.reversesChangeEventId),
    foreignKey({
      columns: [t.reversesChangeEventId],
      foreignColumns: [t.id],
      name: "change_events_reverses_fk",
    }).onDelete("restrict"),
    check(
      "change_events_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.type)} and ${nonEmpty(t.summaryPl)}`,
    ),
    check("change_events_occurred_at_valid", instant(t.occurredAt)),
    check(
      "change_events_json_valid",
      sql`json_valid(${t.beforeJson}) and json_valid(${t.afterJson})`,
    ),
    check(
      "change_events_reversal_valid",
      sql`${t.reversesChangeEventId} is null or ${t.reversesChangeEventId} <> ${t.id}`,
    ),
  ],
);

export const checkpoints = sqliteTable(
  "checkpoints",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    createdAt: text("created_at").notNull(),
    snapshotFormat: text("snapshot_format").notNull(),
    snapshotVersion: integer("snapshot_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    reasonPl: text("reason_pl").notNull(),
    changeEventId: text("change_event_id").references(() => changeEvents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("checkpoints_created_at_idx").on(t.createdAt),
    check(
      "checkpoints_required_text",
      sql`${nonEmpty(t.id)} and ${nonEmpty(t.label)} and ${nonEmpty(t.reasonPl)}`,
    ),
    check("checkpoints_created_at_valid", instant(t.createdAt)),
    check("checkpoints_snapshot_format_valid", nonEmpty(t.snapshotFormat)),
    check("checkpoints_snapshot_version_valid", sql`${t.snapshotVersion} > 0`),
    check("checkpoints_schema_version_valid", sql`${t.schemaVersion} > 0`),
    check("checkpoints_snapshot_json_valid", sql`json_valid(${t.snapshotJson})`),
    check(
      "checkpoints_sha256_valid",
      sql`length(${t.snapshotSha256}) = 64 and ${t.snapshotSha256} not glob '*[^0-9a-f]*'`,
    ),
  ],
);
