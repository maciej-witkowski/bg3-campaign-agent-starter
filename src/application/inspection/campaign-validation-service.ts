import {
  validateCampaignState,
  type CampaignValidationStateReader,
  type CampaignValidationViolation,
} from "../../domain/validation/campaign-validation.js";

export interface CampaignValidationResult {
  readonly valid: boolean;
  readonly violations: readonly CampaignValidationViolation[];
}

export interface CampaignValidationReadPort {
  read<T>(operation: (state: CampaignValidationStateReader) => T): T;
}

export class CampaignValidationService {
  public constructor(private readonly source: CampaignValidationReadPort) {}

  public validate(): CampaignValidationResult {
    return this.source.read((state) => {
      const violations = validateCampaignState(state);
      return { valid: violations.length === 0, violations };
    });
  }
}
