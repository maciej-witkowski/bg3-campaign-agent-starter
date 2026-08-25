import { describe, expect, it } from "vitest";

import {
  EnvironmentConfigurationError,
  parseEnvironment,
} from "../../../src/config/environment.js";

describe("parseEnvironment", () => {
  it("uses safe defaults when optional values are absent", () => {
    expect(parseEnvironment({})).toEqual({
      NODE_ENV: "development",
      BG3_AGENT_LOG_LEVEL: "info",
    });
  });

  it("accepts supported environment values and ignores unrelated variables", () => {
    expect(
      parseEnvironment({
        NODE_ENV: "production",
        BG3_AGENT_LOG_LEVEL: "warn",
        UNRELATED_HOST_VARIABLE: "ignored",
      }),
    ).toEqual({
      NODE_ENV: "production",
      BG3_AGENT_LOG_LEVEL: "warn",
    });
  });

  it("treats blank optional values as absent", () => {
    expect(
      parseEnvironment({
        NODE_ENV: "  ",
        BG3_AGENT_LOG_LEVEL: "",
      }),
    ).toEqual({
      NODE_ENV: "development",
      BG3_AGENT_LOG_LEVEL: "info",
    });
  });

  it("reports invalid values without exposing the complete environment", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "staging",
        SECRET_NOT_OWNED_BY_THE_APP: "do-not-report",
      }),
    ).toThrow(EnvironmentConfigurationError);

    try {
      parseEnvironment({ NODE_ENV: "staging", SECRET_NOT_OWNED_BY_THE_APP: "do-not-report" });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      expect(String(error)).toContain("NODE_ENV");
      expect(String(error)).not.toContain("do-not-report");
    }
  });
});
