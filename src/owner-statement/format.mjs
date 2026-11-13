/**
 * Integer cents to a dollar string. `formatCents(-34671, { parens: true })` is "($346.71)";
 * without `parens` a negative reads "-$346.71". A figure that is not whole cents throws:
 * the statement never rounds on the owner's behalf.
 */
export function formatCents(cents, { parens = false } = {}) {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`formatCents needs whole cents, got ${String(cents)}`);
  }
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = `$${dollars}.${String(abs % 100).padStart(2, "0")}`;
  if (cents < 0) return parens ? `(${body})` : `-${body}`;
  return body;
}
