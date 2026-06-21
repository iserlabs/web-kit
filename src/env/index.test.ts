import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateEnv } from "./index";

describe("validateEnv", () => {
  it("returns parsed values on success", () => {
    const schema = z.object({ PORT: z.string() });
    expect(validateEnv(schema, { PORT: "3000" })).toEqual({ PORT: "3000" });
  });

  it("throws an error naming each invalid variable", () => {
    const schema = z.object({ API_KEY: z.string(), DB_URL: z.string() });
    expect(() => validateEnv(schema, {})).toThrow(/API_KEY[\s\S]*DB_URL/);
  });
});
