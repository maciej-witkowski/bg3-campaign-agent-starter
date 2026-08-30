import type {
  ChangesView,
  CharacterView,
  EquipmentView,
  IllithidView,
  InventoryView,
  PartyView,
  SpellsView,
} from "../application/inspection/campaign-inspection.js";
import type { CampaignValidationResult } from "../application/inspection/campaign-validation-service.js";
import type { CliCommandName } from "./cli-contract.js";

export function renderHumanSuccess(command: CliCommandName, data: unknown): string {
  if (command === "party") return renderParty(data as PartyView);
  if (command === "character") return renderCharacter(data as CharacterView);
  if (command === "equipment") return renderEquipment(data as EquipmentView);
  if (command === "inventory") return renderInventory(data as InventoryView);
  if (command === "spells") return renderSpells(data as SpellsView);
  if (command === "illithid") return renderIllithid(data as IllithidView);
  if (command === "changes") return renderChanges(data as ChangesView);
  if (command === "validate") return renderValidation(data as CampaignValidationResult);
  const value = data as { readonly outputPath: string; readonly artifactFormat: string };
  return `Eksport zakończony (${value.artifactFormat.toUpperCase()}): ${value.outputPath}\n`;
}

export function renderHumanFailure(message: string): string {
  return `Błąd: ${message}\n`;
}

function renderParty(value: PartyView): string {
  return section(
    "Aktywna drużyna",
    value.characters.map(
      (character) =>
        `${character.displayNamePl} — ${character.classPl} ${character.level} — ${character.roleSummary} — Atrybuty: ${formatAttributes(character.attributes)}`,
    ),
  );
}

function formatAttributes(attributes: PartyView["characters"][number]["attributes"]): string {
  if (attributes.length === 0) return "— brak —";
  return attributes
    .map(
      (attribute) => `${attribute.attribute} ${attribute.baseValue} → ${attribute.effectiveValue}`,
    )
    .join(", ");
}

function renderCharacter(value: CharacterView): string {
  return (
    [
      `${value.character.displayNamePl} (${value.character.canonicalName})`,
      `${value.character.classPl}${value.character.subclassPl === null ? "" : ` / ${value.character.subclassPl}`} — poziom ${value.character.level}`,
      "Atrybuty:",
      ...rows(
        value.attributes.map(
          (attribute) =>
            `${attribute.attribute}: ${attribute.baseValue} → ${attribute.effectiveValue}`,
        ),
      ),
      "Zdolności:",
      ...rows(
        value.abilities.map(
          (ability) => `${ability.definition.namePl} — ${ability.assignment.source}`,
        ),
      ),
    ].join("\n") + "\n"
  );
}

function renderEquipment(value: EquipmentView): string {
  return section(
    `Ekwipunek: ${value.character.displayNamePl}`,
    value.items.map(
      (item) => `${item.assignment.slot}: ${item.definition.namePl} [${item.inventoryItem.id}]`,
    ),
  );
}

function renderInventory(value: InventoryView): string {
  return section(
    "Inwentarz",
    value.items.map(
      (item) =>
        `${item.definition.namePl} — ${item.inventoryItem.status} — ${item.owner?.displayNamePl ?? "bez właściciela"}`,
    ),
  );
}

function renderSpells(value: SpellsView): string {
  return section(
    `Czary: ${value.character.displayNamePl}`,
    value.spells.map(
      (spell) =>
        `${spell.definition.level}: ${spell.definition.namePl} — ${spell.assignment.source}${spell.assignment.prepared ? " — przygotowany" : ""}`,
    ),
  );
}

function renderIllithid(value: IllithidView): string {
  return section(
    value.character === null
      ? "Moce illithidów"
      : `Moce illithidów: ${value.character.displayNamePl}`,
    value.powers.map(
      (power) =>
        `${power.definition.namePl} — poziom ${unknown(power.definition.tier)}${power.acquisition === null ? "" : " — nabyta"}`,
    ),
  );
}

function renderChanges(value: ChangesView): string {
  return section(
    `Ostatnie zmiany (limit ${value.limit})`,
    value.changes.map(
      (change) => `${change.occurredAt.toISOString()} — ${change.type} — ${change.summaryPl}`,
    ),
  );
}

function renderValidation(value: CampaignValidationResult): string {
  if (value.valid) return "Stan kampanii jest poprawny.\n";
  return section(
    `Stan kampanii jest niepoprawny (${value.violations.length})`,
    value.violations.map(
      (violation) => `${violation.code}: ${violation.message} [${violation.entityIds.join(", ")}]`,
    ),
  );
}

function section(title: string, values: readonly string[]): string {
  return `${title}\n${rows(values).join("\n")}\n`;
}

function rows(values: readonly string[]): readonly string[] {
  return values.length === 0 ? ["— brak —"] : values.map((value) => `- ${value}`);
}

function unknown(value: unknown): string {
  return value === null || value === undefined ? "nieznane" : String(value);
}
