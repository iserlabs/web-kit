import { describe, expect, it } from "vitest";
import { checkLaunchHtml } from "./launch.mjs";

const good = `<html><head><link rel="icon" href="/favicon.ico"><meta property="og:image" content="/og.png"></head>
<body><footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></body></html>`;
const codes = (h: string) => checkLaunchHtml(h).map((f: { code: string }) => f.code);

describe("checkLaunchHtml", () => {
  it("passes a page with footer links, favicon and preview image", () => {
    expect(codes(good)).toEqual([]);
  });
  it("flags missing legal links", () => {
    expect(codes(good.replace(/<footer>.*<\/footer>/, ""))).toEqual(["launch-privacy-link", "launch-terms-link"]);
  });
  it("flags a tracker that loads before consent, not one parked as text/plain", () => {
    expect(codes(good.replace("</body>", '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></body>'))).toContain("launch-tracker-before-consent");
    expect(codes(good.replace("</body>", '<script type="text/plain" src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></body>'))).toEqual([]);
  });
  it("flags a secret key in the page source", () => {
    expect(codes(good.replace("</body>", "<script>var k='sk_live_abcdefghijklmnopqrstuv'</script></body>"))).toContain("launch-secret-exposed");
  });
});
