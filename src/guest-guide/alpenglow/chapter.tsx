import type { CSSProperties } from "react";
import type { FieldId } from "../brand";
import type { ChapterPlan } from "../plan";
import { Blocks } from "./blocks";
import type { RenderImage } from "./image";

export const fieldVar = (f: FieldId) => (f === "paper" ? "var(--paper)" : `var(--f-${f})`);

export function ChapterLabel({ c }: { c: ChapterPlan }) {
  return (
    <p className="chap__label">
      <span className="fig">{c.number}</span>
      {c.showName ? ` ${c.name}` : null}
    </p>
  );
}

/** One chapter: its plate, then the label, the head and one loud thing per screen. */
export function Chapter({ c, render }: { c: ChapterPlan; render: RenderImage }) {
  const style = { "--field": fieldVar(c.field), "--prev": fieldVar(c.prevField) } as CSSProperties;
  const plate = c.plate;
  return (
    <section className="chapter" id={c.id} style={style} aria-labelledby={`${c.id}-h`}>
      {Array.isArray(plate) ? (
        <div className="dip">
          {plate.map((p) => (
            <figure key={p.src}>
              {render({
                src: p.src,
                alt: p.alt,
                width: p.width,
                height: p.height,
                sizes: "(min-width: 1000px) 25vw, 50vw",
                widths: [414, 828, 1170],
              })}
              {p.caption ? <figcaption>{p.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : plate ? (
        <figure className="plate">
          {render({
            src: plate.src,
            alt: plate.alt,
            width: plate.width,
            height: plate.height,
            sizes: "(min-width: 1000px) 50vw, 100vw",
            widths: [414, 828, 1170, 1600],
          })}
        </figure>
      ) : null}
      <div className={plate ? "chap" : "chap chap--solo"}>
        <ChapterLabel c={c} />
        <h2 className="q" id={`${c.id}-h`}>
          {c.head.text}
        </h2>
        <Blocks blocks={c.blocks} render={render} />
      </div>
    </section>
  );
}
