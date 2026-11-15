/**
 * Write every email of a business to a folder for looking at: <name>.html (the exact html a mail
 * app gets), <name>.txt (the plain-text part) and report.json (subject, size, findings). Node only,
 * never imported by a site's server code.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lintMessage } from "./index.mjs";

export function writePreviews(dir, items, lintOptions = {}) {
  mkdirSync(dir, { recursive: true });
  const report = [];
  for (const { name, message, allow } of items) {
    writeFileSync(join(dir, `${name}.html`), message.html);
    writeFileSync(
      join(dir, `${name}.txt`),
      `Subject: ${message.subject}\nFrom: ${message.from}\nTo: ${message.to}\nReply-To: ${message.replyTo ?? ""}\n\n${message.text}`,
    );
    const findings = lintMessage(message, { ...lintOptions, allow });
    report.push({
      name,
      subject: message.subject,
      from: message.from,
      htmlBytes: Buffer.byteLength(message.html, "utf8"),
      findings,
    });
  }
  writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
