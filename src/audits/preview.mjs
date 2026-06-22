import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

export async function waitForReady(baseUrl, timeoutMs, fetchImpl = fetch) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetchImpl(baseUrl);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Preview server at ${baseUrl} not ready within ${timeoutMs}ms`);
}

export function startPreview(previewCommand) {
  // detached → the child leads its own process group, so we can tear down the
  // whole tree (shell + server, e.g. `pnpm build && pnpm start` → next start)
  // with a single group kill (avoids orphaned ports).
  const child = spawn(previewCommand, { shell: true, stdio: "ignore", detached: true });
  child.unref?.();
  return {
    async stop() {
      const signalGroup = (sig) => {
        try {
          if (child.pid) process.kill(-child.pid, sig);
        } catch {
          // already exited / no such process group
        }
      };
      signalGroup("SIGTERM");
      await sleep(500);
      signalGroup("SIGKILL"); // forceful fallback for deep trees that ignore SIGTERM
    },
  };
}
