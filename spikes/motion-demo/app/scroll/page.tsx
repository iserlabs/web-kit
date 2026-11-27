import { ReadingProgress } from "@iserlabs/web-kit/motion";
import { scene } from "../scene";

const photos = [
  ["#e9dfcc", "#8a6a48", 3, "The porch at the front"],
  ["#dccbb0", "#6b5237", 2, "The kitchen table"],
  ["#cdb994", "#5a4636", 4, "The back garden"],
  ["#d9d2c5", "#7a5f43", 1, "The upstairs landing"],
] as const;

const para =
  "Text on this page never starts hidden and never moves. Only the photos rise a little as they come into view, and the thin bar at the top fills as you read. Placeholder art stands in for real photos.";

export default function Page() {
  return (
    <main style={{ padding: "64px 16px 160px", maxWidth: 760, margin: "0 auto" }}>
      <ReadingProgress />
      <h1 style={{ fontWeight: 400, fontSize: "clamp(36px,6vw,72px)", lineHeight: 1, margin: "0 0 16px" }}>Native scroll animation</h1>
      <p style={{ fontSize: 19, lineHeight: 1.55 }}>{para}</p>
      {photos.map(([bg, fg, n, caption]) => (
        <section key={caption} style={{ margin: "96px 0" }}>
          <h2 style={{ fontWeight: 400, fontSize: 30, margin: "0 0 12px" }}>{caption}</h2>
          <p style={{ fontSize: 18, lineHeight: 1.55 }}>{para}</p>
          <figure className="wk-rise" style={{ margin: "24px 0 0" }}>
            <img src={scene(bg, fg, n)} alt={`Placeholder: ${caption.toLowerCase()}`} width={1600} height={900} style={{ width: "100%", height: "auto", display: "block" }} />
            <figcaption style={{ paddingTop: 8, fontSize: 14, color: "#6b5a48" }}>{caption}</figcaption>
          </figure>
        </section>
      ))}
    </main>
  );
}
