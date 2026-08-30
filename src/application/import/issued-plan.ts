import { createHash } from "node:crypto";

export function freezeIssuedPlan<T>(value: T): T {
  return deepFreeze(value, new WeakSet<object>());
}

export function issuedPlanDigest(value: unknown): string {
  const clone = structuredClone(value);
  return createHash("sha256")
    .update(
      JSON.stringify(clone, (_key, nested: unknown) =>
        nested instanceof Map ? [...nested.entries()] : nested,
      ),
      "utf8",
    )
    .digest("hex");
}

function deepFreeze<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, nested] of value) {
      deepFreeze(key, seen);
      deepFreeze(nested, seen);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
    }
  }
  return Object.freeze(value);
}
