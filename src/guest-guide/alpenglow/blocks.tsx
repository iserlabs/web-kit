/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ReactNode } from "react";
import type { Block, PlacedPhoto, StepItem } from "../plan";
import type { RenderImage } from "./image";

/** The visible label is the button's name; a bare "Copy" says what it copies. */
export function copyName(label: string): string | undefined {
  return /password/i.test(label) ? undefined : `${label} the Wi-Fi password`;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      className="copy"
      type="button"
      data-copy={text}
      data-label={label}
      aria-label={copyName(label)}
    >
      {label}
    </button>
  );
}

function Steps({ items, head, headId }: { items: StepItem[]; head?: string; headId?: string }) {
  return (
    <>
      {head ? (
        <h3 className="sub" id={headId}>
          {head}
        </h3>
      ) : null}
      <ol className="steps" role="list">
        {items.map((s, i) => (
          <li key={s.key ?? `${i}-${s.text}`} id={s.id}>
            <span className="n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="t">
              {s.label ? <b>{s.label}</b> : null}
              {s.text}
              {s.where ? <span className="where">{s.where}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function RoomPhotos({ photos, render }: { photos: PlacedPhoto[]; render: RenderImage }) {
  const two = photos.length > 1;
  return (
    <div className={two ? "room room--two" : "room"}>
      {photos.map((p) => (
        <figure key={p.src}>
          {render({
            src: p.src,
            alt: p.alt,
            width: p.width,
            height: p.height,
            sizes: two ? "(min-width: 1000px) 20vw, 50vw" : "(min-width: 1000px) 40vw, 100vw",
            widths: [414, 828, 1170],
          })}
          {p.caption ? <figcaption>{p.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

export function Blocks({ blocks, render }: { blocks: Block[]; render: RenderImage }): ReactNode {
  return blocks.map((b, i) => {
    const k = `${b.kind}-${i}`;
    switch (b.kind) {
      case "p":
        return (
          <p key={k} id={b.id} className={b.tone === "sec" ? "sec" : undefined}>
            {b.text}
          </p>
        );
      case "sub":
        return (
          <h3 key={k} className="sub" id={b.id}>
            {b.text}
          </h3>
        );
      case "steps":
        return <Steps key={k} items={b.items} head={b.head} headId={b.headId} />;
      case "figure":
        return (
          <div key={k} id={b.id}>
            {b.label ? <span className="fact__label">{b.label}</span> : null}
            <p className="big" aria-hidden="true">
              {b.value}
            </p>
            <p>{b.text}</p>
          </div>
        );
      case "display":
        return (
          <div key={k} className="display">
            <span className="fact__label">{b.label}</span>
            <p className="big">{b.value}</p>
          </div>
        );
      case "item":
        return b.asHead ? (
          <div key={k} id={b.id}>
            <h3 className="sub">{b.label}</h3>
            {b.where ? <p className="where">{b.where}</p> : null}
            <p>{b.body}</p>
            {b.until ? <p className="until">{b.until}</p> : null}
            {b.photos ? <RoomPhotos photos={b.photos} render={render} /> : null}
          </div>
        ) : (
          <div key={k} className="fact" id={b.id}>
            <span className="fact__label">{b.label}</span>
            {b.body}
            {b.where ? <span className="where">{b.where}</span> : null}
            {b.until ? <span className="until">{b.until}</span> : null}
            {b.photos ? <RoomPhotos photos={b.photos} render={render} /> : null}
          </div>
        );
      case "unknown":
        return (
          <p key={k} className="fact" id={b.id}>
            <span className="fact__label">{b.label}</span>
            <span className="unknown">{b.text}</span>
          </p>
        );
      case "note":
        return (
          <div key={k} className="note" role="note" id={b.id}>
            <span className="note__label">{b.label}</span>
            <p>{b.text}</p>
          </div>
        );
      case "wifi":
        return (
          <div key={k} className="wifi-block">
            <h3 className="sub" id="wifi">
              {b.head}
            </h3>
            {b.network || b.password ? (
              <div className="wifi">
                <span className="wifi__vals">
                  {b.network}
                  {b.network && b.password ? <br /> : null}
                  {b.password}
                </span>
                {b.password && b.copy ? <CopyButton text={b.password} label={b.copy} /> : null}
              </div>
            ) : null}
            {b.line ? <p>{b.line}</p> : null}
            <Blocks blocks={b.rows} render={render} />
          </div>
        );
      case "table":
        return (
          <div key={k}>
            <table className="price">
              <caption>{b.title}</caption>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={r.item}>
                    <th scope="row">
                      {r.item}
                      {r.note ? <span className="note-cell">{r.note}</span> : null}
                    </th>
                    <td>{r.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.terms ? <p className="terms">{b.terms}</p> : null}
          </div>
        );
      case "picks":
        return b.groups.map((g) => (
          <div key={`${k}-${g.label}`}>
            <h3 className="sub">{g.label}</h3>
            <ul className="picks" role="list">
              {g.picks.map((p) => (
                <li key={p.name}>
                  <a href={p.url}>{p.name}</a>
                  {p.address ? <span>{p.address}</span> : null}
                  {p.drive ? <span>{p.drive}</span> : null}
                  <span className="pick-note">{p.note}</span>
                  {p.hours ? <span>{p.hours}</span> : null}
                  {p.until ? <span>{p.until}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ));
    }
    return null;
  });
}
