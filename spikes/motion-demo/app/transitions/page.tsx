import { TransitionLink } from "@iserlabs/web-kit/motion";

export default function Page() {
  return <main style={{ padding: "96px 24px" }}><h1>Page A</h1><TransitionLink href="/transitions/next">Go to page B</TransitionLink></main>;
}
