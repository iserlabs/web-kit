// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SplatTour, type SplatTourProps } from "./SplatTour";
import type { PlayerOptions, SplatPlayer } from "./scene";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The real player needs WebGL; these tests stand in for it and check what the part does around it.
const startSplatPlayer = vi.fn<(host: HTMLElement, o: PlayerOptions) => Promise<SplatPlayer>>();
vi.mock("./scene", () => ({
  startSplatPlayer: (h: HTMLElement, o: PlayerOptions) => startSplatPlayer(h, o),
}));

const SCAN = "/scans/living-room.spz";
const props: SplatTourProps = {
  src: SCAN,
  label: "3D walk-through of the living room",
  poster: { src: "/photos/living.jpg", alt: "The living room from the door" },
  stills: [
    { src: "/photos/a.jpg", alt: "Sofa and window", caption: "Sofa" },
    { src: "/photos/b.jpg", alt: "Reading corner" },
  ],
};

let host: HTMLDivElement;
let root: Root;
let reduced = false;

function fakePlayer() {
  return { act: vi.fn(), dispose: vi.fn() } satisfies SplatPlayer;
}
// The part loads its player with a dynamic import; wait for that, then for React, so a busy
// machine cannot turn these into timing failures.
const flush = () =>
  act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((r) => setTimeout(r, 0));
  });
const mount = async (p: Partial<SplatTourProps> = {}) => {
  await act(async () => root.render(<SplatTour {...props} {...p} />));
};
const button = (name: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );
const click = async (el: Element | undefined) => {
  expect(el, "button exists").toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await flush();
};
const stage = () => document.querySelector<HTMLElement>(".wk-st__stage");
const key = (el: Element, k: string) => {
  const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
};

vi.setConfig({ testTimeout: 30000 });
beforeAll(async () => {
  // Warm the (mocked) player module so the first tap does not wait on a cold transform.
  await import("./scene");
});

beforeEach(() => {
  reduced = false;
  startSplatPlayer.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce") ? reduced : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe("SplatTour first load", () => {
  it("server markup has the real photo and the button, and never names the scan file", () => {
    const html = renderToStaticMarkup(<SplatTour {...props} />);
    expect(html).toContain('src="/photos/living.jpg"');
    expect(html).toContain("Walk through it");
    expect(html).not.toContain(SCAN);
    expect(html).not.toMatch(/rel="preload"/);
  });
  it("does not start the player until the button is tapped", async () => {
    await mount();
    await flush();
    expect(startSplatPlayer).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLImageElement>(".wk-st__poster")?.alt).toBe(props.poster.alt);
    expect(stage()?.hidden).toBe(true);
  });
});

describe("SplatTour after the tap", () => {
  it("loads the scan once, shows progress, then hands the keyboard to the 3D view", async () => {
    const p = fakePlayer();
    let resolve!: (v: SplatPlayer) => void;
    startSplatPlayer.mockImplementation((_h, o) => {
      o.onProgress?.(0.4);
      return new Promise((r) => {
        resolve = r;
      });
    });
    const onOpen = vi.fn();
    await mount({ onOpen, start: { position: [0, 1, 2] } });
    await click(button("Walk through it"));
    expect(startSplatPlayer).toHaveBeenCalledTimes(1);
    const opts = startSplatPlayer.mock.calls[0]?.[1];
    expect(opts?.src).toBe(SCAN);
    expect(opts?.start).toMatchObject({ x: 0, y: 1, z: 2 });
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      "Loading the 3D walk-through 40%",
    );
    expect(button("Walk through it")).toBeUndefined(); // no second tap while loading

    await act(async () => resolve(p));
    await flush();
    expect(onOpen).toHaveBeenCalledTimes(1);
    const s = stage() as HTMLElement;
    expect(s.hidden).toBe(false);
    expect(s.tabIndex).toBe(0);
    expect(document.activeElement).toBe(s);
    expect(document.querySelector(".wk-st__poster")).toBeNull();

    const ev = key(s, "ArrowUp");
    expect(p.act).toHaveBeenCalledWith("forward");
    expect(ev.defaultPrevented).toBe(true); // the page does not scroll
    expect(key(s, "Tab").defaultPrevented).toBe(false); // Tab still leaves
    await click(button("Turn right"));
    expect(p.act).toHaveBeenLastCalledWith("turnRight");
  });

  it("Esc closes the tour, frees the player and puts focus back on the button", async () => {
    const p = fakePlayer();
    startSplatPlayer.mockResolvedValue(p);
    await mount();
    await click(button("Walk through it"));
    key(stage() as HTMLElement, "Escape");
    await flush();
    expect(p.dispose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button("Walk through it"));
    expect(document.querySelector(".wk-st__poster")).not.toBeNull();
  });

  it("a failed load says so on screen, shows the photos and offers a retry", async () => {
    startSplatPlayer.mockRejectedValueOnce(new Error("WebGL2 is not available"));
    const onError = vi.fn();
    await mount({ onError });
    await click(button("Walk through it"));
    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("could not start on this device");
    expect(alert?.textContent).toContain("WebGL2 is not available");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "WebGL2 is not available" }),
    );
    expect(console.error).toHaveBeenCalled();
    expect(document.querySelector(".wk-st")?.getAttribute("data-state")).toBe("error");
    expect(document.querySelector(".wk-st__poster")).not.toBeNull();
    expect(document.activeElement).toBe(button("Try again"));

    startSplatPlayer.mockResolvedValueOnce(fakePlayer());
    await click(button("Try again"));
    expect(startSplatPlayer).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("a missing scan file is an on-screen error, not a silent no-op", async () => {
    const real = await vi.importActual<typeof import("./scene")>("./scene");
    startSplatPlayer.mockImplementation(real.startSplatPlayer);
    await mount({ src: "" });
    await click(button("Walk through it"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("no scan file");
  });

  it("a bad start pose is an on-screen error and the player never loads", async () => {
    await mount({ start: { position: [0, Number.NaN, 0] } });
    await click(button("Walk through it"));
    expect(startSplatPlayer).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("non-number");
  });

  it("unmounting mid-load frees the player as soon as it arrives", async () => {
    const p = fakePlayer();
    let resolve!: (v: SplatPlayer) => void;
    startSplatPlayer.mockImplementation(() => new Promise((r) => (resolve = r)));
    await mount();
    await click(button("Walk through it"));
    act(() => root.unmount());
    await act(async () => resolve(p));
    expect(p.dispose).toHaveBeenCalledTimes(1);
    root = createRoot(host); // afterEach unmounts again
  });
});

describe("SplatTour under reduced motion", () => {
  it("shows the still gallery, no button, and never loads the player", async () => {
    reduced = true;
    await mount();
    await flush();
    expect(document.querySelector(".wk-st")?.getAttribute("data-state")).toBe("still");
    expect(button("Walk through it")).toBeUndefined();
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".wk-st__stills img"));
    expect(imgs.map((i) => i.alt)).toEqual(["Sofa and window", "Reading corner"]);
    expect(document.querySelector(".wk-st__stills figcaption")?.textContent).toBe("Sofa");
    expect(startSplatPlayer).not.toHaveBeenCalled();
  });
  it("with no stills given, the gallery is the poster, never empty", async () => {
    reduced = true;
    await mount({ stills: [] });
    await flush();
    const imgs = document.querySelectorAll<HTMLImageElement>(".wk-st__stills img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.alt).toBe(props.poster.alt);
  });
});
