export declare function findLeaks(html: string, codes: string[]): string[];
export declare function decide(
  results: { route: string; html?: string; error?: string }[],
  find: (html: string) => string[],
): { lines: string[]; code: 0 | 1 | 2 };
export declare function findForbidden(html: string, strings: string[]): string[];
