// Pure (no SDK import) so it's shared by server config, client loader, and
// unit tests. The shared noise list across all Iser Labs sites.
export const IGNORE_ERRORS: string[] = [
  "Load failed",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "The network connection was lost",
  "The Internet connection appears to be offline",
  "AbortError",
  "cancelled",
  "ResizeObserver loop completed with undelivered notifications",
  "ResizeObserver loop limit exceeded",
];

export function shouldIgnore(message: string): boolean {
  return IGNORE_ERRORS.some((p) => message.includes(p));
}
