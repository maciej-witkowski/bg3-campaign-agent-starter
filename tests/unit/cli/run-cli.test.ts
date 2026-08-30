import { describe, expect, it, vi } from "vitest";

import type { M3CampaignApplication } from "../../../src/composition/m3-campaign-application.js";
import { runCli } from "../../../src/cli/run-cli.js";
import { CampaignInspectionError } from "../../../src/application/inspection/campaign-inspection.js";
import { ArtifactWriteError } from "../../../src/application/export/atomic-artifact-writer.js";
import { SchemaCompatibilityError } from "../../../src/persistence/sqlite/schema-compatibility.js";

describe("runCli", () => {
  it("returns help/version without opening a database", async () => {
    const open = vi.fn<() => M3CampaignApplication>();

    const help = await runCli(["--help"], { openApplication: open, version: "0.3.0" });
    const version = await runCli(["--version"], { openApplication: open, version: "0.3.0" });

    expect(help).toMatchObject({ exitCode: 0, stderr: "" });
    expect(help.stdout).toContain("read-only CLI");
    expect(version).toEqual({ exitCode: 0, stdout: "0.3.0\n", stderr: "" });
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON-mode arguments before opening and emits one JSON document", async () => {
    const open = vi.fn<() => M3CampaignApplication>();

    const result = await runCli(["--json", "party"], { openApplication: open });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      format: "BG3_CLI_RESULT",
      version: 1,
      command: "party",
      ok: false,
      error: { code: "INVALID_ARGUMENTS" },
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps human failures on stderr and closes the application", async () => {
    const application = fakeApplication();
    const close = vi.spyOn(application, "close");

    const result = await runCli(["--db", "campaign.sqlite", "character", "Brak"], {
      openApplication: () => application,
    });

    expect(result).toEqual({
      exitCode: 3,
      stdout: "",
      stderr: "Błąd: Nie znaleziono postaci.\n",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns a complete validation report with exit 4 for invalid state", async () => {
    const application = fakeApplication();
    vi.spyOn(application.validation, "validate").mockReturnValue({
      valid: false,
      violations: [
        { code: "INVENTORY_OWNER_INVALID", entityIds: ["item-1"], message: "Błąd stanu" },
      ],
    });

    const result = await runCli(["--db", "campaign.sqlite", "--json", "validate"], {
      openApplication: () => application,
    });

    expect(result.exitCode).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      data: { valid: false, violations: [{ code: "INVENTORY_OWNER_INVALID" }] },
    });
  });

  it("renders successful human output on stdout", async () => {
    const application = fakeApplication();

    const result = await runCli(["--db", "campaign.sqlite", "party"], {
      openApplication: () => application,
    });

    expect(result).toEqual({ exitCode: 0, stdout: "Aktywna drużyna\n— brak —\n", stderr: "" });
  });

  it("renders export metadata separately from the campaign artifact", async () => {
    const application = fakeApplication();
    const writeJson = vi.spyOn(application.campaignExport, "writeJson");

    const result = await runCli(
      ["--db", "campaign.sqlite", "--json", "export", "--format", "json", "--output", "state.json"],
      { openApplication: () => application },
    );

    const parsed = JSON.parse(result.stdout) as { readonly data: Record<string, unknown> };
    expect(result.exitCode).toBe(0);
    expect(parsed.data).toMatchObject({
      artifactFormat: "json",
      exportFormat: "BG3_CAMPAIGN_EXPORT",
      exportVersion: 1,
    });
    expect(parsed.data).not.toHaveProperty("state");
    expect(writeJson).toHaveBeenCalledWith("state.json", { overwrite: false });

    const xlsx = await runCli(
      [
        "--db",
        "campaign.sqlite",
        "export",
        "--format",
        "xlsx",
        "--output",
        "state.xlsx",
        "--overwrite",
      ],
      { openApplication: () => application },
    );
    expect(xlsx.exitCode).toBe(0);
    expect(application.campaignExport.writeXlsx).toHaveBeenCalledWith("state.xlsx", {
      overwrite: true,
    });
  });

  it("rejects an export target that aliases the campaign database before opening it", async () => {
    const open = vi.fn<() => M3CampaignApplication>();

    const result = await runCli(
      [
        "--db",
        "campaign.sqlite",
        "--json",
        "export",
        "--format",
        "json",
        "--output",
        "campaign.sqlite",
        "--overwrite",
      ],
      { openApplication: open },
    );

    expect(result.exitCode).toBe(5);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { code: "ARTIFACT_WRITE_FAILED" },
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("maps database, export and unexpected failures to stable broad exit categories", async () => {
    const schema = await runCli(["--db", "old.sqlite", "--json", "party"], {
      openApplication: () => {
        throw new SchemaCompatibilityError("SCHEMA_OLDER", "Starszy schemat.");
      },
    });
    const exportApplication = fakeApplication();
    vi.spyOn(exportApplication.campaignExport, "writeJson").mockRejectedValue(
      new ArtifactWriteError("Nie udało się zapisać."),
    );
    const artifact = await runCli(
      ["--db", "campaign.sqlite", "--json", "export", "--format", "json", "--output", "state.json"],
      { openApplication: () => exportApplication },
    );
    const unexpectedApplication = fakeApplication();
    vi.spyOn(unexpectedApplication.inspection, "getParty").mockImplementation(() => {
      throw new Error("sekret wewnętrzny");
    });
    const unexpected = await runCli(["--db", "campaign.sqlite", "--json", "party"], {
      openApplication: () => unexpectedApplication,
    });

    expect(schema.exitCode).toBe(4);
    expect(JSON.parse(schema.stdout)).toMatchObject({ error: { code: "SCHEMA_OLDER" } });
    expect(artifact.exitCode).toBe(5);
    expect(JSON.parse(artifact.stdout)).toMatchObject({
      error: { code: "ARTIFACT_WRITE_FAILED" },
    });
    expect(unexpected.exitCode).toBe(1);
    expect(unexpected.stdout).not.toContain("sekret wewnętrzny");
    expect(JSON.parse(unexpected.stdout)).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});

function fakeApplication(): M3CampaignApplication {
  return {
    inspection: {
      getParty: vi.fn(() => ({ characters: [] })),
      getCharacter: vi.fn(() => {
        throw new CampaignInspectionError("CHARACTER_NOT_FOUND", "Nie znaleziono postaci.");
      }),
      getEquipment: vi.fn(),
      findInventory: vi.fn(),
      getSpells: vi.fn(),
      getIllithid: vi.fn(),
      getChanges: vi.fn(),
    } as unknown as M3CampaignApplication["inspection"],
    validation: {
      validate: vi.fn(() => ({ valid: true, violations: [] })),
    } as unknown as M3CampaignApplication["validation"],
    campaignExport: {
      writeJson: vi.fn(async () => exportValue()),
      writeXlsx: vi.fn(async () => exportValue()),
    } as unknown as M3CampaignApplication["campaignExport"],
    close: vi.fn(),
  };
}

function exportValue() {
  return {
    format: "BG3_CAMPAIGN_EXPORT",
    version: 1,
    sourceSnapshotFormat: "BG3_CAMPAIGN_SNAPSHOT",
    sourceSnapshotVersion: 1,
    schemaVersion: 4,
    exportedAt: "2026-08-30T12:00:00.000Z",
    stateSha256: "a".repeat(64),
    state: {},
  } as never;
}
