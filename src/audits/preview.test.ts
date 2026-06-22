import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { waitForReady } from "./preview.mjs";

describe("waitForReady", () => {
  it("resolves once the server responds", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls < 2) throw new Error("not up");
      return { ok: true };
    };
    await expect(waitForReady("http://localhost:4321", 2000, fetchImpl)).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it("rejects after the timeout", async () => {
    const fetchImpl = async () => {
      throw new Error("never up");
    };
    await expect(waitForReady("http://localhost:4321", 150, fetchImpl)).rejects.toThrow(
      /not ready/,
    );
  });
});
