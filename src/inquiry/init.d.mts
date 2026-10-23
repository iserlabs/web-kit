export function initInquiry(
  siteDir: string,
  opts?: { write?: (path: string, contents: string) => void; exists?: (path: string) => boolean },
): { written: string[]; skipped: string[]; routeSnippet: string };
