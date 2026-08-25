import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const blankStringToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const environmentSchema = z.object({
  NODE_ENV: z.preprocess(
    blankStringToUndefined,
    z.enum(["development", "test", "production"]).default("development"),
  ),
  BG3_AGENT_LOG_LEVEL: z.preprocess(
    blankStringToUndefined,
    z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  ),
});

export type Environment = Readonly<z.infer<typeof environmentSchema>>;

export class EnvironmentConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "EnvironmentConfigurationError";
    this.issues = issues;
  }
}

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    );

    throw new EnvironmentConfigurationError(issues);
  }

  return Object.freeze(result.data);
}

export function loadEnvironment(): Environment {
  loadDotenv({ quiet: true });
  return parseEnvironment(process.env);
}
