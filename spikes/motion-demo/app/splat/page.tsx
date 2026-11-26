import { SplatTour } from "@iserlabs/web-kit/motion/splat-tour";
import { scene } from "../scene";

const poster = { src: scene("#e9dfcc", "#8a6a48", 3), alt: "Placeholder art standing in for a photo of the room" };
const stills = [
  { src: scene("#e9dfcc", "#8a6a48", 3), alt: "Placeholder: the room from the door", caption: "From the door" },
  { src: scene("#dccbb0", "#6b5237", 2), alt: "Placeholder: the sofa wall", caption: "The sofa wall" },
  { src: scene("#cdb994", "#5a4636", 4), alt: "Placeholder: the reading lamp", caption: "The reading lamp" },
];

export default function Page() {
  return (
    <main style={{ padding: "64px 16px 120px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 400, fontSize: "clamp(36px,6vw,72px)", lineHeight: 1, margin: "0 0 12px" }}>SplatTour</h1>
      <p style={{ maxWidth: "60ch", margin: "0 0 32px" }}>
        The photo loads with the page. The scan player and the scan file load only after the button. The scan
        here is a synthetic test room, not a real property.
      </p>
      <SplatTour
        label="3D walk-through of the test room"
        src="/demo-scan.ply"
        poster={poster}
        stills={stills}
        start={{ position: [0, 1.4, 2.2] }}
      />
      <h2 style={{ fontWeight: 400, fontSize: 32, margin: "72px 0 12px" }}>A broken scan file</h2>
      <p style={{ maxWidth: "60ch", margin: "0 0 24px" }}>This one points at a file that does not exist, to show the failure state.</p>
      <SplatTour label="3D walk-through that cannot load" src="/missing-scan.spz" poster={poster} stills={stills.slice(0, 2)} timeoutMs={15000} />
    </main>
  );
}
