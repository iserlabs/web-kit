/**
 * Leak and forbidden-string checks on served HTML. One implementation lives in
 * leaks-core.mjs so the `web-kit guide-leaks` CLI can run it under bare Node.
 * Codes are passed in at run time (from the Ops Hub and Hospitable), never
 * read from a committed file.
 */
export { decide, findForbidden, findLeaks } from "./leaks-core.mjs";
