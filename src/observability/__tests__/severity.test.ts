import { describe, expect, it } from "vitest";
import { getEmojiPrefix } from "../severity";

describe("getEmojiPrefix", () => {
  it("prioritizes kind over severity", () => {
    expect(getEmojiPrefix("critical", "lead")).toBe("📊");
  });
  it("falls back to severity when no kind", () => {
    expect(getEmojiPrefix("critical")).toBe("🔴");
    expect(getEmojiPrefix("warn")).toBe("🟡");
    expect(getEmojiPrefix("info")).toBe("🟢");
  });
});
