import { HeadlineReveal } from "@iserlabs/web-kit/motion";

export default function Page() {
  return (
    <main style={{ padding: "96px 24px" }}>
      <HeadlineReveal as="h1" text="A quiet house at the end of the lane" immediate style={{ fontSize: "clamp(44px,8vw,120px)", fontWeight: 400, lineHeight: 1, maxWidth: "14ch" }} />
      <div style={{ height: "120vh" }} />
      <HeadlineReveal text="Revealed when it scrolls into view" style={{ fontSize: "clamp(36px,6vw,84px)", fontWeight: 400, lineHeight: 1.05, maxWidth: "16ch" }} />
    </main>
  );
}
