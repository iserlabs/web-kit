/**
 * The 3D half of SplatTour: three.js plus the Spark scan player. Only ever reached through a
 * dynamic import after the visitor taps "Walk through it", so neither library nor the scan file
 * is part of the first page load. Needs three >= 0.180 and @sparkjsdev/spark >= 2.4.
 */
import { applyIntent, dragLook, type MoveIntent, type TourPose } from "./controls";

export interface PlayerOptions {
  /** The scan file (.spz, .ply, .splat, .ksplat, .sog). */
  src: string;
  /** Where the visitor stands when the tour opens. */
  start: TourPose;
  /** Phone scans run through COLMAP or Brush come out upside down; true turns them upright. */
  flipY: boolean;
  /** Color behind the scan, any CSS color three.js can read. */
  background: string;
  /** Give up after this long, so a stalled download never looks like loading forever. */
  timeoutMs: number;
  /** 0 to 1 while the file downloads, when the server sends a length. */
  onProgress?: (fraction: number) => void;
}

export interface SplatPlayer {
  /** One key press or button press worth of movement. */
  act(intent: MoveIntent): void;
  /** Stop drawing and free the GPU memory. Safe to call twice. */
  dispose(): void;
}

export async function startSplatPlayer(host: HTMLElement, o: PlayerOptions): Promise<SplatPlayer> {
  if (!o.src) throw new Error("SplatTour: no scan file (src) was given");
  const THREE = await import("three");
  const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");

  // Throws when the device has no WebGL2: the caller shows the photos instead.
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 1000);
  camera.rotation.order = "YXZ";
  const spark = new SparkRenderer({ renderer });
  scene.add(spark);
  const mesh = new SplatMesh({
    url: o.src,
    onProgress: (e: ProgressEvent) => {
      if (e.lengthComputable && e.total > 0) o.onProgress?.(e.loaded / e.total);
    },
  });
  if (o.flipY) mesh.quaternion.set(1, 0, 0, 0);
  scene.add(mesh);

  let disposed = false;
  let pose = o.start;
  const place = () => {
    camera.position.set(pose.x, pose.y, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, 0);
  };
  const size = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(size);

  // Drag to look, with mouse, pen or one finger.
  let drag: { id: number; x: number; y: number } | null = null;
  const down = (e: PointerEvent) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    pose = dragLook(pose, e.clientX - drag.x, e.clientY - drag.y);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    place();
  };
  const up = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) drag = null;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    ro?.disconnect();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    scene.remove(mesh);
    mesh.dispose();
    spark.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`SplatTour: the scan did not load within ${o.timeoutMs / 1000}s`)),
        o.timeoutMs,
      );
    });
    try {
      await Promise.race([mesh.initialized, timeout]);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    dispose();
    throw err instanceof Error ? err : new Error(`SplatTour: the scan failed to load (${err})`);
  }

  canvas.className = "wk-st__canvas";
  canvas.style.touchAction = "none";
  host.appendChild(canvas);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  ro?.observe(host);
  size();
  place();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  return {
    act(intent) {
      if (disposed) return;
      pose = applyIntent(pose, intent, o.start);
      place();
    },
    dispose,
  };
}
