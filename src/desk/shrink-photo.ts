/**
 * A photograph made small enough to travel through a form, in the browser, before it is sent.
 *
 * WHY. The host refuses any request body over about 4.5 MB before our server code runs, and a
 * phone or camera photograph is often 5 to 15 MB. The event kit's poster form sends its photograph
 * inside the form, so a large one failed with the host's answer and not ours. The poster is drawn
 * at web sizes, so a copy with a 2400 pixel long edge loses nothing it can show.
 *
 * A small photograph is sent as it is. A large one is redrawn at 2400 pixels on its long edge as a
 * JPEG at quality 0.85, then 0.7 and 0.55 if it is still over 4 MB. A photograph the browser cannot
 * open (a HEIC photo in Chrome) is refused in a sentence that says how to export a JPEG.
 *
 * Never throws: every outcome is a result the screen can print. The file's name is not used for
 * anything but its ending, and never goes in a header.
 */

export const SHRINK_ABOVE = 3.5 * 1024 * 1024;
export const SEND_LIMIT = 4 * 1024 * 1024;
export const LONG_EDGE = 2400;
const QUALITIES = [0.85, 0.7, 0.55];

export const NOT_OPENED =
  "This browser cannot open that photograph. If it is a HEIC photo, export it as a JPEG first: on a Mac, open it in Preview, choose File, then Export, and pick JPEG. Or open this page in Safari.";
export const STILL_TOO_BIG =
  "That photograph is still too large to send after it was made smaller. Export a smaller copy and try again.";

/** The size that fits inside `max` on its long edge, never larger than the original. */
export function fitWithin(width: number, height: number, max = LONG_EDGE) {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export type Shrunk = { ok: true; file: File } | { ok: false; error: string };

/** The browser parts, named so a test can stand in for them. */
export type Drawing = {
  decode: (file: File) => Promise<{ width: number; height: number; draw: unknown }>;
  encode: (
    image: { width: number; height: number; draw: unknown },
    size: { width: number; height: number },
    quality: number,
  ) => Promise<Blob | null>;
};

export const browserDrawing: Drawing = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  },
  async encode(image, size, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(image.draw as ImageBitmap, 0, 0, size.width, size.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  },
};

export async function shrinkForForm(
  file: File,
  drawing: Drawing = browserDrawing,
): Promise<Shrunk> {
  const plain = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (plain && file.size <= SHRINK_ABOVE) return { ok: true, file };
  let image: Awaited<ReturnType<Drawing["decode"]>>;
  try {
    image = await drawing.decode(file);
  } catch {
    return { ok: false, error: NOT_OPENED };
  }
  const size = fitWithin(image.width, image.height);
  for (const q of QUALITIES) {
    const blob = await drawing.encode(image, size, q).catch(() => null);
    if (!blob) return { ok: false, error: NOT_OPENED };
    if (blob.size <= SEND_LIMIT) {
      return { ok: true, file: new File([blob], "photo.jpg", { type: "image/jpeg" }) };
    }
  }
  return { ok: false, error: STILL_TOO_BIG };
}
