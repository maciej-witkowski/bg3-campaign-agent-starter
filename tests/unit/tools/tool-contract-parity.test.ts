import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  CONTRACT_SCHEMA_PAIRS,
  getCharacterInputSchema,
  getRecentChangesInputSchema,
  mutationConfirmationSchema,
} from "../../../src/tools/contracts/index.js";

type JsonSchema = Readonly<Record<string, unknown>>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSchema(path: string): JsonSchema {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8")) as JsonSchema;
}

function resolveReference(
  schemaPath: string,
  reference: string,
): { schema: JsonSchema; path: string } {
  if (reference.startsWith("#")) {
    return { schema: resolveFragment(readSchema(schemaPath), reference), path: schemaPath };
  }
  const [fileReference, fragment] = reference.split("#", 2);
  const path = relative(
    repositoryRoot,
    resolve(repositoryRoot, dirname(schemaPath), fileReference ?? ""),
  ).replaceAll("\\", "/");
  const schema = readSchema(path);
  return {
    schema: fragment === undefined ? schema : resolveFragment(schema, `#${fragment}`),
    path,
  };
}

function resolveFragment(schema: JsonSchema, fragment: string): JsonSchema {
  if (fragment === "#" || fragment === "") return schema;
  const segments = fragment
    .replace(/^#\//u, "")
    .split("/")
    .map((value) => value.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current: unknown = schema;
  for (const segment of segments) current = (current as Record<string, unknown>)[segment];
  return current as JsonSchema;
}

function variants(schema: JsonSchema): readonly JsonSchema[] | undefined {
  const values = schema.oneOf ?? schema.anyOf;
  return Array.isArray(values) ? (values as readonly JsonSchema[]) : undefined;
}

function sampleFor(schema: JsonSchema, schemaPath: string): unknown {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    return sampleFor(resolved.schema, resolved.path);
  }
  const choices = variants(schema);
  if (choices !== undefined) return sampleFor(choices[0] ?? {}, schemaPath);
  if ("const" in schema) return schema.const;
  if (Array.isArray(schema.enum)) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const result: Record<string, unknown> = {};
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
      for (const key of (schema.required ?? []) as readonly string[])
        result[key] = sampleFor(properties[key] ?? {}, schemaPath);
      return result;
    }
    case "array": {
      const count = Math.max(typeof schema.minItems === "number" ? schema.minItems : 0, 1);
      return Array.from({ length: count }, () =>
        sampleFor((schema.items ?? {}) as JsonSchema, schemaPath),
      );
    }
    case "string":
      return schema.format === "date-time" ? "2026-09-01T10:00:00.000Z" : "wartość";
    case "integer":
    case "number":
      return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}

function isValid(schema: JsonSchema, value: unknown, schemaPath: string): boolean {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    return isValid(resolved.schema, value, resolved.path);
  }
  if (Array.isArray(schema.oneOf))
    return (
      schema.oneOf.filter((candidate) => isValid(candidate as JsonSchema, value, schemaPath))
        .length === 1
    );
  if (Array.isArray(schema.anyOf))
    return schema.anyOf.some((candidate) => isValid(candidate as JsonSchema, value, schemaPath));
  if ("const" in schema && value !== schema.const) return false;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;

  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    if (((schema.required ?? []) as readonly string[]).some((key) => !(key in object)))
      return false;
    if (
      schema.additionalProperties === false &&
      Object.keys(object).some((key) => !(key in properties))
    )
      return false;
    return Object.entries(object).every(([key, nested]) => {
      const property = properties[key];
      return property === undefined || isValid(property, nested, schemaPath);
    });
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
    if (
      schema.uniqueItems === true &&
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    )
      return false;
    return value.every((item) => isValid((schema.items ?? {}) as JsonSchema, item, schemaPath));
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return false;
    if (typeof schema.minLength === "number" && value.length < schema.minLength) return false;
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return false;
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value))
      return false;
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) return false;
    return true;
  }
  if (schema.type === "integer" && (typeof value !== "number" || !Number.isInteger(value)))
    return false;
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value)))
    return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "null" && value !== null) return false;
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) return false;
    if (typeof schema.maximum === "number" && value > schema.maximum) return false;
  }
  return true;
}

function invalidSamples(schema: JsonSchema, schemaPath: string): readonly unknown[] {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    return invalidSamples(resolved.schema, resolved.path);
  }
  const branch = variants(schema)?.[0] ?? schema;
  if (branch.type !== "object") return [];
  const valid = sampleFor(branch, schemaPath) as Record<string, unknown>;
  const result: unknown[] = [];
  if (branch.additionalProperties === false) result.push({ ...valid, unexpected: true });
  const required = (branch.required ?? []) as readonly string[];
  const firstRequired = required[0];
  if (firstRequired !== undefined) {
    const missing = { ...valid };
    delete missing[firstRequired];
    result.push(missing);
    result.push({ ...valid, [firstRequired]: { wrong: "type" } });
  }
  return result;
}

describe("M4 normative JSON Schema and Zod contract parity", () => {
  it("declares exactly one Zod pair for every individual JSON Schema artifact", () => {
    const files = ["schemas/domain", "schemas/tools", "schemas/tool-outputs"]
      .flatMap((directory) =>
        readdirSync(resolve(repositoryRoot, directory))
          .filter((name) => name.endsWith(".schema.json"))
          .map((name) => `${directory}/${name}`),
      )
      .sort();
    const pairs = CONTRACT_SCHEMA_PAIRS.map(({ jsonSchemaPath }) => jsonSchemaPath).sort();

    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toEqual(files);
  });

  it.each(CONTRACT_SCHEMA_PAIRS)("accepts the normative minimum for $jsonSchemaPath", (pair) => {
    const jsonSchema = readSchema(pair.jsonSchemaPath);
    const sample = sampleFor(jsonSchema, pair.jsonSchemaPath);

    expect(isValid(jsonSchema, sample, pair.jsonSchemaPath)).toBe(true);
    expect(pair.zodSchema.safeParse(sample).success).toBe(true);
  });

  it.each(CONTRACT_SCHEMA_PAIRS)(
    "rejects the same top-level negative corpus for $jsonSchemaPath",
    (pair) => {
      const jsonSchema = readSchema(pair.jsonSchemaPath);
      for (const sample of invalidSamples(jsonSchema, pair.jsonSchemaPath)) {
        expect(isValid(jsonSchema, sample, pair.jsonSchemaPath)).toBe(false);
        expect(pair.zodSchema.safeParse(sample).success).toBe(false);
      }
    },
  );

  it("keeps confirmation variants exclusive and rejects blank provenance", () => {
    expect(mutationConfirmationSchema.safeParse({ proposal_id: "P-1" }).success).toBe(true);
    expect(
      mutationConfirmationSchema.safeParse({
        direct_fact: true,
        source_utterance: "Zdobyłem przedmiot.",
      }).success,
    ).toBe(true);
    expect(
      mutationConfirmationSchema.safeParse({
        proposal_id: "P-1",
        direct_fact: true,
        source_utterance: "Zdobyłem przedmiot.",
      }).success,
    ).toBe(false);
    expect(mutationConfirmationSchema.safeParse({ proposal_id: "   " }).success).toBe(false);
  });

  it("does not coerce invalid values or mutate caller input while applying a documented default", () => {
    expect(getCharacterInputSchema.safeParse({ character: 42 }).success).toBe(false);
    const input: Record<string, unknown> = {};
    const before = structuredClone(input);
    const parsed = getRecentChangesInputSchema.parse(input);

    expect(input).toEqual(before);
    expect(parsed).not.toBe(input);
    expect(parsed).toEqual({ limit: 20 });
  });

  it("does not call downstream work after boundary validation fails", () => {
    const handler = vi.fn();
    const invoke = (input: unknown): void => {
      const parsed = getCharacterInputSchema.safeParse(input);
      if (parsed.success) handler(parsed.data);
    };

    invoke({ character: "" });
    expect(handler).not.toHaveBeenCalled();
  });
});
