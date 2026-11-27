# Motion kit usage

Import the CSS once, wrap the app once, then use the parts. Everything is a client component
with a reduced-motion version and a server-safe first render.

    // app/globals.css
    @import "@iserlabs/web-kit/motion/css";

    // app/layout.tsx
    import { MotionProvider, PageTransitions } from "@iserlabs/web-kit/motion";
    <MotionProvider smoothScroll>   {/* smoothScroll is opt-in, default off */}
      <PageTransitions>{children}</PageTransitions>
    </MotionProvider>

Also add `"@iserlabs/web-kit"` to `transpilePackages`, and install what you use:
`pnpm add gsap@3.15.1 lenis` (sequence, provider), `pnpm add three @react-three/fiber @types/three` (room picker;
`@iserlabs/web-kit/motion` names three in its imports, so a site importing it needs three and its types even when it
only uses HeadlineReveal). SplatTour has its own entry point and needs `pnpm add three@^0.187.0 @sparkjsdev/spark@2.4.0`
(Spark needs three 0.180 or newer).

## Tokens (#20)
`import { tokens, easings, exitMs, staggerDelayMs, PRESS_SCALE } from "@iserlabs/web-kit/motion/tokens"`.
CSS twins: `--wk-dur`, `--wk-dur-exit`, `--wk-ease-out`, `--wk-ease-in-out`, `--wk-press-scale`, `--wk-stagger`.

## MotionProvider (#13)
GSAP 3.12.5 to 3.15.x (tested on 3.15.1) + ScrollTrigger registered once (lazy), Lenis only with `smoothScroll`. Both off under
reduced motion and torn down if the setting flips. On route change: scroll to top, refresh triggers.
`useMotion()` returns `{ reduced, ready, smooth }`.

## ScrollSequence (#14)
    <ScrollSequence label="Five stages of a room" cue="Scroll to set the room" badge="Illustration"
      stages={[{ src, srcSet, alt, width: 2752, height: 1536, title: "Bare walls", text: "...", railLabel: "Handover", focalPhone: 56 }, ...]} />
Pinned layout is the base markup, so nothing shifts when JS arrives. Reduced motion (CSS only) and a
failed GSAP load both show a still vertical series. Do not wrap it in a transformed or overflow parent
(pinning breaks).

## RoomPicker3D (#16)
    <RoomPicker3D label="Rooms" poster={{ src, alt }} hint="Hover a room, click to fly in."
      volumes={[{ id: "201", label: "Room 201", sublabel: "Floor 2", position: [0,0,0], size: [1.5,1.5,2.4],
                  photos: [{ src, alt }], summary: "..." }]} />
three.js and R3F load only once it is near the viewport. Reduced motion (or three not yet loaded):
direct cross-fade to the photo. Chips give keyboard and phone access. Esc goes back, arrows change photo.

## HeadlineReveal (#19)
    <HeadlineReveal as="h1" text="A quiet house on the hill" immediate />
Mask reveal per visual line, CSS only, plays once, screen readers get the real text once.
Reduced motion: short fade.

HeadlineReveal stays on its own CSS line splitter, not GSAP SplitText (free since GSAP 3.13): SplitText would make
the headline wait for a lazy GSAP download before it can show, and add GSAP to a part that needs no library. No Flip
helper was added: no part animates between two layouts.

## Page transitions (#17)
`<PageTransitions>` once, then `<TransitionLink href="/rooms">` (or `useTransitionNavigate()`).
Same-document View Transitions with a plain-navigation fallback; the css carries the reduced-motion guard.

## SplatTour (3D scan walk-through)
    import { SplatTour } from "@iserlabs/web-kit/motion/splat-tour";
    <SplatTour label="3D walk-through of the living room" src="/scans/living-room.spz"
      poster={{ src: "/photos/living.jpg", alt: "The living room from the front door" }}
      stills={[{ src, alt, caption }, ...]} start={{ position: [0, 1.4, 2], yawDeg: 0 }} />
What it does: a real photo with a "Walk through it" button. Only the tap downloads three.js, the Spark scan player
and the scan file, so none of it is in the first page load. Drag to look; arrow keys or W A S D move and turn,
Page Up and Page Down look up and down, Home goes back to the start, Esc closes and puts focus back on the button;
on-screen Turn, Forward, Back and Close buttons do the same on a phone. Reduced motion: a still photo gallery, no
button, the player never loads. If the 3D view cannot start (no WebGL, missing file, 60 second timeout) the photo
stays, the reason shows on screen with a Try again button, and the gallery appears. Make the scan with
`~/.claude/scripts/footage/splat-web.sh` (its `splat.ply`); `flipY` (default on) turns COLMAP and Brush scans upright.
Use when: a room is worth exploring and a real scan exists. Never as the hero; never instead of the photos.

## Native scroll animation (CSS only)
    <ReadingProgress />                       {/* thin bar at the top that fills as the visitor reads */}
    <figure className="wk-rise"><img ... /><figcaption>...</figcaption></figure>   {/* or <img className="wk-rise"> */}
What it does: `animation-timeline: view()` makes a photo fade in and rise 24px as it enters the window
(`--wk-rise-distance` to change); `animation-timeline: scroll()` fills the reading bar. No JavaScript.
Photos only: `.wk-rise` animates the `img`, `picture` or `video` inside it, never the caption or any text, and never
goes on the hero photo (house rule C31). Browsers without scroll timelines and visitors with reduced motion get every
photo fully visible and no bar. Use when: long reading pages (guides, area pages, owner reports) and photo-led stories.

## Not built yet
- #15 subject-in-front hero (TODO)
- #18 polish mode (TODO)
