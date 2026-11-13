import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRANDS } from "./index.mjs";

type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  pattern?: string;
  minimum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
};

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const schema = read("./schema.json") as Schema;

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

/** The small slice of JSON Schema the contract uses: type, const, enum, required, properties, items, pattern, bounds. */
function check(value: unknown, s: Schema, path: string, errors: string[]) {
  if (s.const !== undefined && value !== s.const)
    errors.push(`${path}: must be ${String(s.const)}`);
  if (s.enum && !s.enum.includes(value))
    errors.push(`${path}: not one of ${JSON.stringify(s.enum)}`);
  if (s.type) {
    const want = Array.isArray(s.type) ? s.type : [s.type];
    const got = typeOf(value);
    const ok = want.includes(got) || (got === "integer" && want.includes("number"));
    if (!ok) {
      errors.push(`${path}: expected ${want.join(" or ")}, got ${got}`);
      return;
    }
  }
  if (typeof value === "string") {
    if (s.pattern && !new RegExp(s.pattern).test(value))
      errors.push(`${path}: does not match ${s.pattern}`);
    if (s.minLength && value.length < s.minLength) errors.push(`${path}: too short`);
  }
  if (typeof value === "number" && s.minimum !== undefined && value < s.minimum)
    errors.push(`${path}: below ${s.minimum}`);
  if (Array.isArray(value)) {
    if (s.minItems !== undefined && value.length < s.minItems)
      errors.push(`${path}: fewer than ${s.minItems} items`);
    if (s.maxItems !== undefined && value.length > s.maxItems)
      errors.push(`${path}: more than ${s.maxItems} items`);
    if (s.items) {
      for (const [i, v] of value.entries()) check(v, s.items, `${path}[${i}]`, errors);
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of s.required ?? []) if (!(key in obj)) errors.push(`${path}.${key}: missing`);
    for (const [key, sub] of Object.entries(s.properties ?? {})) {
      if (key in obj) check(obj[key], sub, `${path}.${key}`, errors);
    }
  }
}

describe("schema.json", () => {
  it("lists the brands the renderer knows", () => {
    const brand = schema.properties?.brand?.enum;
    expect([...(brand ?? [])].sort()).toEqual(Object.keys(BRANDS).sort());
  });

  for (const name of ["sun-mountain", "palisade", "columbus", "xenia"]) {
    it(`${name} fixture matches the schema`, () => {
      const errors: string[] = [];
      check(read(`./fixtures/${name}.json`), schema, "$", errors);
      expect(errors).toEqual([]);
    });
  }

  it("a model with the wrong shape is caught by the schema", () => {
    const bad = read("./fixtures/sun-mountain.json");
    bad.moves.cents = 12.5;
    bad.summary.rows[0].role = "bonus";
    delete bad.owner;
    const errors: string[] = [];
    check(bad, schema, "$", errors);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
