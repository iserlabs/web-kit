import { describe, expect, it } from "vitest";
import * as root from "../index";

describe("client-safe observability barrel", () => {
  it("exports the pure surface", () => {
    expect(root.baseSentryOptions).toBeTypeOf("function");
    expect(root.scrubEvent).toBeTypeOf("function");
    expect(root.getEmojiPrefix).toBeTypeOf("function");
    expect(root.IGNORE_ERRORS.length).toBeGreaterThan(0);
    expect(root.REPLAY_MASKING_DEFAULTS.maskAllText).toBe(true);
  });
});
