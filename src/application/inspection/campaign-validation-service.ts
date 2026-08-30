import {
  validateCampaignState,
  type CampaignValidationStateReader,
  type CampaignValidationViolation,
} from "../../domain/validation/campaign-validation.js";

export interface CampaignValidationResult {
  readonly valid: boolean;
  readonly violations: readonly CampaignValidationViolation[];
}

export class CampaignValidationService {
  public constructor(private readonly state: CampaignValidationStateReader) {}

  public validate(): CampaignValidationResult {
    const violations = validateCampaignState(this.state);
    return { valid: violations.length === 0, violations };
  }
}
