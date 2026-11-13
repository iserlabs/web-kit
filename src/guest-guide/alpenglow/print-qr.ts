import qrcode from "qrcode-generator";

/**
 * The Wi-Fi join code for the printed door card, made at build time as one SVG
 * path (no script, no request). Text is encoded as UTF-8 bytes, so a network
 * name with an accent survives. Error correction M, the size chosen to fit.
 */
export function qrPath(payload: string): { size: number; path: string } {
  const qr = qrcode(0, "M");
  const utf8 = String.fromCharCode(...new TextEncoder().encode(payload));
  qr.addData(utf8, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let path = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      let run = 1;
      while (c + run < n && qr.isDark(r, c + run)) run++;
      path += `M${c + quiet} ${r + quiet}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  return { size: n + quiet * 2, path };
}
