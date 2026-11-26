import { HeadlineReveal, TransitionLink } from "@iserlabs/web-kit/motion";

const pages = [["/sequence", "ScrollSequence"], ["/headline", "HeadlineReveal"], ["/rooms", "RoomPicker3D"], ["/transitions", "Page transitions"], ["/splat", "SplatTour"], ["/scroll", "Native scroll animation"]];

export default function Home() {
  return (
    <main style={{ padding: "96px 24px", maxWidth: 720, margin: "0 auto" }}>
      <HeadlineReveal as="h1" text="Motion kit, one page per part" immediate style={{ fontSize: "clamp(40px,7vw,88px)", fontWeight: 400, lineHeight: 1 }} />
      <ul>{pages.map(([h, n]) => <li key={h} style={{ fontSize: 22, margin: "12px 0" }}><TransitionLink href={h}>{n}</TransitionLink></li>)}</ul>
    </main>
  );
}
