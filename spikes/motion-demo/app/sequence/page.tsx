import { ScrollSequence } from "@iserlabs/web-kit/motion";
import { scene } from "../scene";

const names = ["Bare walls", "Floors sanded", "Furniture in", "Styled", "First night"];
const stages = names.map((title, i) => ({
  src: scene(["#d9d2c5", "#d8c3a0", "#c9b48f", "#b79c78", "#5a4636"][i] as string, "#7a5f43", i + 1),
  alt: `Illustrated stage ${i + 1}: ${title}`,
  width: 1600,
  height: 900,
  title,
  text: `Stage ${i + 1} of five. Placeholder art.`,
  railLabel: title,
  focalPhone: 20 + i * 15,
}));

export default function Page() {
  return (
    <>
      <ScrollSequence label="Five stages of a room" stages={stages} cue="Scroll" badge="Illustration" intro={<h1>One room, five stages</h1>} />
      <section style={{ padding: "120px 24px", maxWidth: 720, margin: "0 auto" }}><p>After the sequence.</p></section>
    </>
  );
}
