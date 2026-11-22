import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderStatement } from "./render.mjs";
import { validate } from "./validate.mjs";

const USAGE = `Usage: web-kit owner-statement <validate|render>
  web-kit owner-statement validate <model.json>
  web-kit owner-statement render <model.json> --logo <path-or-url> --out <file.html> [--pdf <file.pdf>] [--alt <text>]`;

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Pixel size of a PNG, JPEG or SVG, so the page can reserve the logo's space. */
function imageSize(bytes, mime) {
  if (mime === "image/png" && bytes.length > 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  if (mime === "image/svg+xml") {
    const text = bytes.toString("utf8");
    const box = text.match(/viewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (box) return { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
  }
  return { width: 400, height: 100 };
}

async function loadLogo(source, alt) {
  let bytes;
  let mime;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`could not download the logo (${res.status}): ${source}`);
    bytes = Buffer.from(await res.arrayBuffer());
    mime =
      (res.headers.get("content-type") || "").split(";")[0] ||
      MIME[extname(new URL(source).pathname).toLowerCase()];
  } else {
    bytes = readFileSync(source);
    mime = MIME[extname(source).toLowerCase()];
  }
  if (!mime) throw new Error(`the logo must be a png, jpg, svg or webp: ${source}`);
  const { width, height } = imageSize(bytes, mime);
  return { src: `data:${mime};base64,${bytes.toString("base64")}`, alt, width, height };
}

const escText = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function standalone({ html, css, title, fontsHref }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escText(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<style>body{margin:0}</style>
<style>${css}</style>
</head>
<body>
${html}
</body>
</html>
`;
}

function chromePath() {
  const mine = resolve(homedir(), ".claude/bin/chrome-headless");
  if (existsSync(mine)) return mine;
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  return null;
}

function toPdf(htmlFile, pdfFile) {
  const chrome = chromePath();
  if (!chrome) {
    throw new Error(
      "no headless Chrome found: set CHROME_PATH to a Chrome or Chromium binary to build the PDF",
    );
  }
  mkdirSync(dirname(resolve(pdfFile)), { recursive: true });
  const r = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=10000",
      `--print-to-pdf=${resolve(pdfFile)}`,
      pathToFileURL(resolve(htmlFile)).href,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0 || !existsSync(pdfFile)) {
    throw new Error(
      `Chrome did not write the PDF: ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" ")}`,
    );
  }
}

function readModel(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`could not read ${file} as JSON: ${e.message}`);
  }
}

/** Runs `web-kit owner-statement ...`. Returns the process exit code. */
export async function runOwnerStatement(args, log = console.log) {
  const [sub, file] = args;
  try {
    if (sub === "validate" && file) {
      const errors = validate(readModel(file));
      for (const e of errors) log(`[error] ${e}`);
      log(
        errors.length
          ? `web-kit owner-statement validate: FAILED (${errors.length})`
          : "web-kit owner-statement validate: OK",
      );
      return errors.length ? 1 : 0;
    }
    if (sub === "render" && file) {
      const logoSource = flag(args, "--logo");
      const out = flag(args, "--out");
      const pdf = flag(args, "--pdf");
      if (!logoSource || !out) {
        log("owner-statement render needs --logo <path-or-url> and --out <file.html>");
        return 1;
      }
      const model = readModel(file);
      const errors = validate(model);
      if (errors.length) {
        for (const e of errors) log(`[error] ${e}`);
        log(`web-kit owner-statement render: FAILED (${errors.length}), nothing written`);
        return 1;
      }
      const logo = await loadLogo(logoSource, flag(args, "--alt") || model.business);
      const rendered = renderStatement(model, {
        logo,
        pdfHref: pdf ? `./${basename(pdf)}` : undefined,
      });
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out, standalone(rendered));
      log(`wrote  ${out}`);
      if (pdf) {
        toPdf(out, pdf);
        log(`wrote  ${pdf}`);
      }
      return 0;
    }
  } catch (e) {
    log(`web-kit owner-statement: ${e.message}`);
    return 1;
  }
  log(USAGE);
  return 1;
}
