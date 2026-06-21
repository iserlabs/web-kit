import { describe, expect, it } from "vitest";
import * as server from "../server";

describe("server barrel", () => {
  it("exports the full server surface", () => {
    expect(server.notify).toBeTypeOf("function");
    expect(server.alertDiscord).toBeTypeOf("function");
    expect(server.notifyLead).toBeTypeOf("function");
    expect(server.checkAndRecord).toBeTypeOf("function");
    expect(server.getEmojiPrefix).toBeTypeOf("function");
  });
});
