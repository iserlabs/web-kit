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
`pnpm add gsap@3.12.7 lenis` (sequence, provider), `pnpm add three @react-three/fiber` (room picker only).

## Tokens (#20)
`import { tokens, easings, exitMs, staggerDelayMs, PRESS_SCALE } from "@iserlabs/web-kit/motion/tokens"`.
CSS twins: `--wk-dur`, `--wk-dur-exit`, `--wk-ease-out`, `--wk-ease-in-out`, `--wk-press-scale`, `--wk-stagger`.

## MotionProvider (#13)
GSAP 3.12.x + ScrollTrigger registered once (lazy), Lenis only with `smoothScroll`. Both off under
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

## Page transitions (#17)
`<PageTransitions>` once, then `<TransitionLink href="/rooms">` (or `useTransitionNavigate()`).
Same-document View Transitions with a plain-navigation fallback; the css carries the reduced-motion guard.

## Not built yet
- #15 subject-in-front hero (TODO)
- #18 polish mode (TODO)
