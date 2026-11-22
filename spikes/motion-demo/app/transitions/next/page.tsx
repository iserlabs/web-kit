import { TransitionLink } from "@iserlabs/web-kit/motion";

export default function Page() {
  return <main style={{ padding: "96px 24px", background: "#e7dcc6", minHeight: "100vh" }}><h1>Page B</h1><TransitionLink href="/transitions">Back to page A</TransitionLink></main>;
}
