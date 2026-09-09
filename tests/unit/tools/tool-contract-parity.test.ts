import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  compareEquipmentInputSchema,
  CONTRACT_SCHEMA_PAIRS,
  getCharacterInputSchema,
  getIllithidStateOutputSchema,
  getRecentChangesInputSchema,
  mutationConfirmationSchema,
  resolveItemIdentityInputSchema,
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
  if (Array.isArray(values)) return values as readonly JsonSchema[];
  if (Array.isArray(schema.type))
    return schema.type.map((type) => ({ ...schema, type })) as readonly JsonSchema[];
  return undefined;
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
  if (Array.isArray(schema.type))
    return schema.type.some((type) => isValid({ ...schema, type }, value, schemaPath));
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

function deepInvalidSamples(schema: JsonSchema, schemaPath: string): readonly unknown[] {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    return deepInvalidSamples(resolved.schema, resolved.path);
  }
  const choices = variants(schema);
  if (choices !== undefined)
    return choices
      .flatMap((choice) => deepInvalidSamples(choice, schemaPath))
      .filter((candidate) => !isValid(schema, candidate, schemaPath));

  const valid = sampleFor(schema, schemaPath);
  const result: unknown[] = [];
  if (schema.type === "object") {
    const object = valid as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of (schema.required ?? []) as readonly string[]) {
      const missing = { ...object };
      delete missing[key];
      result.push(missing);
    }
    if (schema.additionalProperties === false) result.push({ ...object, unexpected: true });
    for (const [key, property] of Object.entries(properties)) {
      const base = { ...object, [key]: sampleFor(property, schemaPath) };
      for (const nested of deepInvalidSamples(property, schemaPath))
        result.push({ ...base, [key]: nested });
    }
    result.push([]);
  } else if (schema.type === "array") {
    const itemSchema = (schema.items ?? {}) as JsonSchema;
    if (typeof schema.minItems === "number")
      result.push(
        Array.from({ length: Math.max(0, schema.minItems - 1) }, () =>
          sampleFor(itemSchema, schemaPath),
        ),
      );
    if (typeof schema.maxItems === "number")
      result.push(
        Array.from({ length: schema.maxItems + 1 }, () => sampleFor(itemSchema, schemaPath)),
      );
    if (schema.uniqueItems === true) {
      const item = sampleFor(itemSchema, schemaPath);
      result.push([item, item]);
    }
    for (const nested of deepInvalidSamples(itemSchema, schemaPath)) result.push([nested]);
    result.push({});
  } else if (schema.type === "string") {
    if (typeof schema.minLength === "number" && schema.minLength > 0) result.push("");
    if (typeof schema.maxLength === "number") result.push("x".repeat(schema.maxLength + 1));
    if (typeof schema.pattern === "string") result.push("\n");
    if (schema.format === "date-time") result.push("nie-data");
    result.push(42);
  } else if (schema.type === "integer") {
    result.push(1.5, "1");
    if (typeof schema.minimum === "number") result.push(schema.minimum - 1);
    if (typeof schema.maximum === "number") result.push(schema.maximum + 1);
  } else if (schema.type === "number") {
    result.push("1");
    if (typeof schema.minimum === "number") result.push(schema.minimum - 1);
    if (typeof schema.maximum === "number") result.push(schema.maximum + 1);
  } else if (schema.type === "boolean") result.push("true");
  else if (schema.type === "null") result.push(false);
  if (Array.isArray(schema.enum)) result.push("__outside_enum__");
  if ("const" in schema) result.push("__not_const__");
  return result;
}

function fullyPopulatedSamples(schema: JsonSchema, schemaPath: string): readonly unknown[] {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    return fullyPopulatedSamples(resolved.schema, resolved.path);
  }
  const choices = variants(schema);
  if (choices !== undefined)
    return choices
      .flatMap((choice) => fullyPopulatedSamples(choice, schemaPath))
      .filter((candidate) => isValid(schema, candidate, schemaPath));
  if (schema.type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    const samplesByProperty = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        fullyPopulatedSamples(property, schemaPath),
      ]),
    ) as Record<string, readonly unknown[]>;
    const baseline = Object.fromEntries(
      Object.entries(samplesByProperty).map(([key, samples]) => [
        key,
        samples[0] ?? sampleFor(properties[key] ?? {}, schemaPath),
      ]),
    );
    return [
      baseline,
      ...Object.entries(samplesByProperty).flatMap(([key, samples]) =>
        samples.slice(1).map((sample) => ({ ...baseline, [key]: sample })),
      ),
    ].filter((candidate) => isValid(schema, candidate, schemaPath));
  }
  if (schema.type === "array") {
    const itemSchema = (schema.items ?? {}) as JsonSchema;
    return fullyPopulatedSamples(itemSchema, schemaPath).map((sample) => [sample]);
  }
  return [sampleFor(schema, schemaPath)];
}

function assertSupportedKeywords(schema: JsonSchema, schemaPath: string): void {
  if (typeof schema.$ref === "string") {
    const resolved = resolveReference(schemaPath, schema.$ref);
    assertSupportedKeywords(resolved.schema, resolved.path);
    return;
  }
  const supported = new Set([
    "$schema",
    "$id",
    "$ref",
    "$defs",
    "title",
    "description",
    "default",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "minimum",
    "maximum",
    "enum",
    "const",
    "oneOf",
    "anyOf",
  ]);
  for (const key of Object.keys(schema))
    expect(supported.has(key), `unsupported JSON Schema keyword ${key}`).toBe(true);
  for (const nested of Object.values((schema.properties ?? {}) as Record<string, JsonSchema>))
    assertSupportedKeywords(nested, schemaPath);
  for (const nested of Object.values((schema.$defs ?? {}) as Record<string, JsonSchema>))
    assertSupportedKeywords(nested, schemaPath);
  if (typeof schema.items === "object" && schema.items !== null)
    assertSupportedKeywords(schema.items as JsonSchema, schemaPath);
  for (const nested of variants(schema) ?? []) assertSupportedKeywords(nested, schemaPath);
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
    "accepts fully populated values and every union branch for $jsonSchemaPath",
    (pair) => {
      const jsonSchema = readSchema(pair.jsonSchemaPath);
      const samples = fullyPopulatedSamples(jsonSchema, pair.jsonSchemaPath);
      expect(samples.length).toBeGreaterThan(0);
      for (const sample of samples) {
        expect(isValid(jsonSchema, sample, pair.jsonSchemaPath)).toBe(true);
        expect(pair.zodSchema.safeParse(sample).success).toBe(true);
      }
    },
    15_000,
  );

  it.each(CONTRACT_SCHEMA_PAIRS)(
    "rejects the same recursive boundary corpus for $jsonSchemaPath",
    (pair) => {
      const jsonSchema = readSchema(pair.jsonSchemaPath);
      assertSupportedKeywords(jsonSchema, pair.jsonSchemaPath);
      const samples = [
        ...invalidSamples(jsonSchema, pair.jsonSchemaPath),
        ...deepInvalidSamples(jsonSchema, pair.jsonSchemaPath),
      ];
      expect(samples.length).toBeGreaterThan(0);
      for (const sample of samples) {
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

  it("keeps unscoped illithid acquisition explicitly nullable but never stringly typed", () => {
    const definitionsPath = "schemas/tool-outputs/read-tool-output-definitions.json";
    const acquiredSchema = resolveFragment(
      readSchema(definitionsPath),
      "#/$defs/getIllithidState/properties/powers/items/properties/acquired",
    );
    expect(isValid(acquiredSchema, true, definitionsPath)).toBe(true);
    expect(isValid(acquiredSchema, false, definitionsPath)).toBe(true);
    expect(isValid(acquiredSchema, null, definitionsPath)).toBe(true);
    expect(isValid(acquiredSchema, "false", definitionsPath)).toBe(false);

    const power = {
      id: "power-1",
      name_pl: "Próba",
      name_en: null,
      tier: null,
      description_pl: null,
      verification_status: "VERIFIED",
      prerequisite_power_ids: [],
      acquired: null,
      acquired_at: null,
      acquisition_source_pl: null,
      notes: null,
    };
    expect(
      getIllithidStateOutputSchema.safeParse({ character: null, powers: [power] }).success,
    ).toBe(true);
    expect(
      getIllithidStateOutputSchema.safeParse({
        character: null,
        powers: [{ ...power, acquired: "false" }],
      }).success,
    ).toBe(false);
  });

  it("covers every array-form nullable type branch and rejects values outside the union", () => {
    const definitionsPath = "schemas/tool-outputs/read-tool-output-definitions.json";
    const definitions = readSchema(definitionsPath);
    const cases = [
      {
        fragment: "#/$defs/nullableString",
        valid: ["wartość", null],
        generated: ["wartość", null],
        invalid: [42, false, {}],
        generatedInvalid: [42, false],
      },
      {
        fragment: "#/$defs/ability/properties/level_acquired",
        valid: [1, null],
        generated: [0, null],
        invalid: [1.5, "1", {}],
        generatedInvalid: [1.5, "1"],
      },
      {
        fragment: "#/$defs/itemEffect/properties/numeric_value",
        valid: [1.5, null],
        generated: [0, null],
        invalid: ["1.5", false, {}],
        generatedInvalid: ["1", false],
      },
    ] as const;
    for (const entry of cases) {
      const schema = resolveFragment(definitions, entry.fragment);
      for (const value of entry.valid) expect(isValid(schema, value, definitionsPath)).toBe(true);
      for (const value of entry.invalid)
        expect(isValid(schema, value, definitionsPath)).toBe(false);
      expect(fullyPopulatedSamples(schema, definitionsPath)).toEqual(
        expect.arrayContaining([...entry.generated]),
      );
      expect(deepInvalidSamples(schema, definitionsPath)).toEqual(
        expect.arrayContaining([...entry.generatedInvalid]),
      );
    }
  });

  it("does not coerce or mutate input and applies every documented default", () => {
    expect(getCharacterInputSchema.safeParse({ character: 42 }).success).toBe(false);
    const input: Record<string, unknown> = {};
    const before = structuredClone(input);
    const parsed = getRecentChangesInputSchema.parse(input);

    expect(input).toEqual(before);
    expect(parsed).not.toBe(input);
    expect(parsed).toEqual({ limit: 20 });
    expect(
      compareEquipmentInputSchema.parse({ character: "laezel", candidate_item: "item-1" }),
    ).toEqual({
      character: "laezel",
      candidate_item: "item-1",
      include_party_synergies: true,
    });
    expect(resolveItemIdentityInputSchema.parse({ name_pl: "Przedmiot" })).toEqual({
      name_pl: "Przedmiot",
      allow_external_research: true,
    });
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
