import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM module
import { assertPortFree, portOf, waitForReady } from "./preview.mjs";

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

describe("assertPortFree", () => {
  /**
   * The guard that stops the audit answering about somebody else's site. Without it,
   * `startPreview` spawns a server that cannot bind, `waitForReady` pings the squatter,
   * and every finding below describes a different codebase.
   */
  it("passes when nothing is listening", async () => {
    const port = await freePort();
    await expect(assertPortFree(`http://localhost:${port}`)).resolves.toBeUndefined();
  });

  it("REFUSES when something already holds the port, and says what to do", async () => {
    const server = createServer();
    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
    });
    try {
      await expect(assertPortFree(`http://localhost:${port}`)).rejects.toThrow(/already listening/);
      await expect(assertPortFree(`http://localhost:${port}`)).rejects.toThrow(/AUDIT_PORT/);
    } finally {
      server.close();
    }
  });

  /* A remote baseUrl is somebody auditing a deployed site deliberately. Of course
     something is listening there; refusing would break the one legitimate case. */
  it("does not check a host that is not local", async () => {
    await expect(assertPortFree("https://example.com")).resolves.toBeUndefined();
  });
});

describe("portOf", () => {
  it("reads the port, and defaults the way a URL does", () => {
    expect(portOf("http://localhost:4090")).toBe(4090);
    expect(portOf("http://localhost")).toBe(80);
    expect(portOf("https://example.com")).toBe(443);
  });
});

async function freePort(): Promise<number> {
  const s = createServer();
  const port = await new Promise<number>((resolve) => {
    s.listen(0, "127.0.0.1", () => resolve((s.address() as AddressInfo).port));
  });
  await new Promise((r) => s.close(r));
  return port;
}
