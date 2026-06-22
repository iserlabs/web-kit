export default {
  previewCommand: "pnpm exec http-server src/audits/__fixtures__/static-site-ext -p 4398 -s",
  baseUrl: "http://localhost:4398",
  readyTimeoutMs: 15000,
  headers: { requireCsp: false },
  contrast: { cssFile: "missing.css", minRatio: 4.5 },
};
