import { deserializeCampaignExport, serializeCampaignExport } from "./campaign-export.js";
import { createCampaignExport, type CampaignExportV1 } from "./campaign-export.js";
import type { CampaignExportTargetPolicy } from "./campaign-export-target.js";
import {
  prepareArtifactTarget,
  writeVerifiedArtifactToResolvedTarget,
  type ArtifactWriteOptions,
} from "./atomic-artifact-writer.js";

export interface CampaignExportSourcePort {
  captureCurrentState(capturedAt: Date): string;
}

export interface ExportClock {
  now(): Date;
}

export interface CampaignXlsxCodec {
  serialize(value: CampaignExportV1): Promise<Uint8Array>;
  deserialize(bytes: Uint8Array): Promise<CampaignExportV1>;
}

export class CampaignExportService {
  public constructor(
    private readonly source: CampaignExportSourcePort,
    private readonly clock: ExportClock,
    private readonly xlsx: CampaignXlsxCodec,
    private readonly targetPolicy?: CampaignExportTargetPolicy,
  ) {}

  public capture(): CampaignExportV1 {
    const capturedAt = this.clock.now();
    return createCampaignExport(this.source.captureCurrentState(capturedAt));
  }

  public async writeJson(
    targetPath: string,
    options: ArtifactWriteOptions = {},
  ): Promise<CampaignExportV1> {
    const target = prepareArtifactTarget(targetPath);
    this.targetPolicy?.assertSafe(target.path);
    const value = this.capture();
    const bytes = new TextEncoder().encode(serializeCampaignExport(value));
    await writeVerifiedArtifactToResolvedTarget(
      target,
      bytes,
      (published) => {
        deserializeCampaignExport(new TextDecoder().decode(published));
      },
      options,
      this.targetPolicy,
    );
    return value;
  }

  public async writeXlsx(
    targetPath: string,
    options: ArtifactWriteOptions = {},
  ): Promise<CampaignExportV1> {
    const target = prepareArtifactTarget(targetPath);
    this.targetPolicy?.assertSafe(target.path);
    const value = this.capture();
    const bytes = await this.xlsx.serialize(value);
    await writeVerifiedArtifactToResolvedTarget(
      target,
      bytes,
      async (published) => {
        await this.xlsx.deserialize(published);
      },
      options,
      this.targetPolicy,
    );
    return value;
  }
}
