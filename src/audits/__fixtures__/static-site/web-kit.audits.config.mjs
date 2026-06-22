export default {
  previewCommand: "pnpm exec http-server src/audits/__fixtures__/static-site -p 4399 -s",
  baseUrl: "http://localhost:4399",
  readyTimeoutMs: 15000,
  headers: { requireCsp: false },
  contrast: { cssFile: "missing.css", minRatio: 4.5 },
};
