function getHeader(headers, name) {
  if (typeof headers.get === "function") return headers.get(name);
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

export function checkHeaders(headers, opts) {
  const findings = [];
  if (opts.requireCsp && !getHeader(headers, "content-security-policy")) {
    findings.push({
      severity: "error",
      code: "header-csp-missing",
      message: "Response is missing a Content-Security-Policy header",
      route: opts.route,
    });
  }
  if (!getHeader(headers, "x-content-type-options")) {
    findings.push({
      severity: "warn",
      code: "header-xcto-missing",
      message: "Response is missing X-Content-Type-Options: nosniff",
      route: opts.route,
    });
  }
  return findings;
}
