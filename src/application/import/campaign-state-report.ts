import { normalizeCampaignExport, type CampaignExportV1 } from "../export/campaign-export.js";
import { parseImportReport, type ImportReport } from "./import-contracts.js";

export interface CampaignImportEvidence {
  readonly databasePath: string;
  readonly firstImportChanged: boolean;
  readonly secondImportChanged: boolean;
  readonly auditEventCount: number;
  readonly integrityCheck: string;
  readonly foreignKeyViolationCount: number;
}

export function renderCampaignStateReport(
  exportValue: CampaignExportV1,
  reportValue: ImportReport,
  evidence: CampaignImportEvidence,
): string {
  const campaignExport = normalizeCampaignExport(exportValue);
  const report = parseImportReport(reportValue);
  const state = campaignExport.state;
  const names = new Map(
    state.characters.map((row) => [row.id as string, row.displayNamePl as string]),
  );
  const definitions = new Map(
    state.itemDefinitions.map((row) => [row.id as string, row.namePl as string]),
  );
  const inventory = new Map(state.inventoryItems.map((row) => [row.id as string, row]));
  const lines = [
    "# Raport faktycznego importu istniejącej kampanii",
    "",
    `- Baza SQLite: \`${evidence.databasePath}\``,
    `- Profil źródłowy: \`${report.workbookProfile}\``,
    `- SHA-256 źródła: \`${report.workbookSha256}\``,
    `- SHA-256 stanu: \`${campaignExport.stateSha256}\``,
    `- Pierwszy import zmienił stan: ${yesNo(evidence.firstImportChanged)}`,
    `- Powtórny import zmienił stan: ${yesNo(evidence.secondImportChanged)}`,
    `- Zdarzenia audytowe: ${evidence.auditEventCount}`,
    `- SQLite integrity_check: \`${evidence.integrityCheck}\``,
    `- Naruszenia kluczy obcych: ${evidence.foreignKeyViolationCount}`,
    "",
    "## Liczność kolekcji",
    "",
    "| Kolekcja | Wiersze |",
    "|---|---:|",
    ...Object.entries(state).map(([collection, rows]) => `| ${collection} | ${rows.length} |`),
    "",
    "## Postacie i statystyki",
    "",
    "| Postać | Poziom | Klasa | STR | DEX | CON | INT | WIS | CHA |",
    "|---|---:|---|---:|---:|---:|---:|---:|---:|",
    ...state.characters.map((character) => characterLine(character, state)),
    "",
    "## Wyposażenie",
    "",
    ...state.characters.flatMap((character) => {
      const characterId = character.id as string;
      const rows = state.equipment.filter((row) => row.characterId === characterId);
      return [
        `### ${character.displayNamePl as string}`,
        "",
        ...(rows.length === 0
          ? ["Brak wyposażenia."]
          : rows.map((row) => {
              const item = inventory.get(row.inventoryItemId as string);
              const name =
                item === undefined
                  ? "[brak instancji]"
                  : definitions.get(item.itemDefinitionId as string);
              return `- ${row.slot as string}: ${name ?? "[brak definicji]"}`;
            })),
        "",
      ];
    }),
    "## Zawartość skrzyni podróżnej",
    "",
    ...state.inventoryItems
      .filter((row) => row.status === "CHEST")
      .map(
        (row) =>
          `- ${definitions.get(row.itemDefinitionId as string) ?? "[brak definicji]"} × ${row.quantity as number}`,
      ),
    "",
    "## Zdolności przypisane postaciom",
    "",
    ...state.characters.map((character) => {
      const id = character.id as string;
      return `- ${names.get(id)}: zdolności ${state.characterAbilities.filter((row) => row.characterId === id).length}, czary ${state.characterSpells.filter((row) => row.characterId === id).length}, moce illithidów ${state.characterIllithidPowers.filter((row) => row.characterId === id).length}`;
    }),
    "",
    "## Wynik raportu importu",
    "",
    "| Kategoria | Liczba |",
    "|---|---:|",
    ...["inserted", "matched", "skipped", "ambiguous", "conflicts"].map(
      (category) =>
        `| ${category} | ${report.entries.filter((entry) => entry.category === category).length} |`,
    ),
    "",
    "## Nierozwiązane wpisy",
    "",
    ...unresolvedLines(report),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function characterLine(
  character: CampaignExportV1["state"]["characters"][number],
  state: CampaignExportV1["state"],
): string {
  const id = character.id as string;
  const values = new Map(
    state.characterAttributes
      .filter((row) => row.characterId === id)
      .map((row) => [row.attribute as string, row.baseValue as number]),
  );
  for (const modifier of state.permanentModifiers.filter(
    (row) => row.characterId === id && row.active === true && row.targetType === "ATTRIBUTE",
  )) {
    const key = modifier.targetKey as string;
    values.set(key, (values.get(key) ?? 0) + (modifier.modifier as number));
  }
  return `| ${character.displayNamePl as string} | ${character.level as number} | ${character.classPl as string} | ${attribute(values, "STR")} | ${attribute(values, "DEX")} | ${attribute(values, "CON")} | ${attribute(values, "INT")} | ${attribute(values, "WIS")} | ${attribute(values, "CHA")} |`;
}

function attribute(values: ReadonlyMap<string, number>, key: string): string {
  return values.get(key)?.toString() ?? "?";
}

function unresolvedLines(report: ImportReport): readonly string[] {
  const unresolved = report.entries.filter(
    (entry) => entry.category === "ambiguous" || entry.category === "conflicts",
  );
  return unresolved.length === 0
    ? ["Brak nierozwiązanych wpisów."]
    : unresolved.map(
        (entry) =>
          `- ${entry.category}: ${entry.source.sheet}:${entry.source.row}${entry.source.field === null ? "" : ` (${entry.source.field})`} — ${entry.messagePl}`,
      );
}

function yesNo(value: boolean): string {
  return value ? "tak" : "nie";
}
