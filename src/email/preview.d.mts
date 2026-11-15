import type { ComposedMessage } from "./index.mjs";

export function writePreviews(
  dir: string,
  items: { name: string; message: ComposedMessage; allow?: string[] }[],
  lintOptions?: { bannedPhones?: string[] },
): {
  name: string;
  subject: string;
  from: string;
  htmlBytes: number;
  findings: { code: string; message: string }[];
}[];
