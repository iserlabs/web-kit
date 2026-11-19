/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { CSSProperties, ReactNode } from "react";
import type { GuideBrand } from "../brand";
import type { DayAnswer, DayItem, DayPlan, RailStop, RestChapter } from "../day";
import type { Block, PickPlan, PlacedPhoto, Plan, StepItem } from "../plan";
import { Video } from "./blocks";
import { fieldVar } from "./chapter";
import { Wordmark } from "./cover";
import type { RenderImage } from "./image";
import { qrPath } from "./print-qr";

/** The rail's words: Jake's list (Contents, Back, Next) and Close, heard only by screen readers on the x. */
export const RAIL_WORDS = {
  contents: "Contents",
  back: "Back",
  next: "Next",
  close: "Close",
} as const;

const tel = (phone: string) => phone.replace(/[^\d+]/g, "");
const dot = (f: Parameters<typeof fieldVar>[0]) => ({ "--dot": fieldVar(f) }) as CSSProperties;

function Steps({ items, cls = "c-steps" }: { items: StepItem[]; cls?: string }) {
  return (
    <ol className={cls} role="list">
      {items.map((s, i) => (
        <li key={s.key ?? `${i}-${s.text}`} id={s.id}>
          <span className="n" aria-hidden="true">
            {i + 1}
          </span>
          <span className="t">
            {s.label ? <b>{s.label}</b> : null}
            {s.label ? " " : null}
            {s.text}
            {s.where ? <span className="where">{s.where}</span> : null}
          </span>
          {s.video ? (
            <div className="media">
              <Video v={s.video} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Sheet({ photos, render }: { photos: PlacedPhoto[]; render: RenderImage }) {
  const one = photos.length === 1;
  return (
    <div className={one ? "c-sheet one" : "c-sheet"}>
      {photos.map((p) => (
        <figure key={p.src}>
          {render({
            src: p.src,
            alt: p.alt,
            width: p.width,
            height: p.height,
            sizes: one ? "(min-width: 700px) 640px, 100vw" : "(min-width: 700px) 25vw, 50vw",
            widths: [414, 828, 1170],
          })}
          {p.caption ? <figcaption>{p.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function Tail({ where, until }: { where?: string; until?: string }) {
  return (
    <>
      {where ? <span className="where">{where}</span> : null}
      {until ? <span className="until">{until}</span> : null}
    </>
  );
}

/** One quick answer on the line: the question in the accent, the live answer in the display serif. */
function Answer({
  a,
  field,
  render,
}: {
  a: DayAnswer;
  field: DayAnswerField;
  render: RenderImage;
}) {
  return (
    <li className="c-it" id={a.id} style={dot(field)}>
      <h3 className="c-k">{a.label}</h3>
      <div className="c-v">
        {a.time ? (
          <span className="c-time fig">{a.time}</span>
        ) : (
          <p>
            {[a.lead, a.text].filter(Boolean).join(" ")}
            <Tail where={a.where} until={a.until} />
          </p>
        )}
        {a.steps?.length ? <Steps items={a.steps} /> : null}
      </div>
      {a.video ? (
        <div className="c-box">
          <Video v={a.video} />
        </div>
      ) : null}
      {a.photos?.length
        ? a.photos.map((p) => (
            <figure className="c-fig" key={p.src}>
              {render({
                src: p.src,
                alt: p.alt,
                width: p.width,
                height: p.height,
                sizes: "(min-width: 700px) 600px, 100vw",
                widths: [414, 828, 1170],
              })}
            </figure>
          ))
        : null}
    </li>
  );
}
type DayAnswerField = Parameters<typeof fieldVar>[0];

function Table({ b }: { b: Extract<Block, { kind: "table" }> }) {
  return (
    <>
      <table className="c-tbl">
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
      {b.terms ? <p className="c-terms">{b.terms}</p> : null}
    </>
  );
}

function Pick({ p }: { p: PickPlan }) {
  return (
    <details className="c-pk">
      <summary>
        <span className="nm">{p.name}</span>
        {p.drive ? <span className="mt">{p.drive}</span> : null}
      </summary>
      <div className="bd">
        {p.address ? <p className="hrs">{p.address}</p> : null}
        {p.note ? <p>{p.note}</p> : null}
        {p.hours ? <p className="hrs">{p.hours}</p> : null}
        {p.until ? <p className="hrs">{p.until}</p> : null}
        <a href={p.url}>{p.name}</a>
      </div>
    </details>
  );
}

function LinkRow({ b }: { b: Extract<Block, { kind: "link" }> }) {
  return (
    <p className="row-link" id={b.id}>
      <a href={b.href}>
        {b.label}
        {b.external ? (
          <>
            <span aria-hidden="true"> &#8599;</span>
            <span className="vh"> (another site)</span>
          </>
        ) : null}
      </a>
    </p>
  );
}

/** A block in a printed section (and the unlabeled blocks on the day line), set the board's way. */
function Printed({ b }: { b: Block }): ReactNode {
  switch (b.kind) {
    case "item":
      return (
        <>
          <div className="c-r" id={b.id}>
            <h3>{b.label}</h3>
            <p>
              {b.body}
              <Tail where={b.where} until={b.until} />
            </p>
          </div>
          {b.video ? (
            <div className="c-box">
              <Video v={b.video} />
            </div>
          ) : null}
        </>
      );
    case "figure":
      return (
        <div className="c-r" id={b.id}>
          {b.label ? <h3>{b.label}</h3> : null}
          <p>{b.text}</p>
        </div>
      );
    case "display":
      return (
        <div className="c-r">
          <h3>{b.label}</h3>
          <p>{b.value}</p>
        </div>
      );
    case "unknown":
    case "note":
      return (
        <div className="c-r" id={b.id}>
          <h3>{b.label}</h3>
          <p>{b.text}</p>
        </div>
      );
    case "sub":
      return (
        <h3 className="c-sub" id={b.id}>
          {b.text}
        </h3>
      );
    case "p":
      return (
        <p className={b.tone === "sec" ? "c-p sec" : "c-p"} id={b.id}>
          {b.text}
        </p>
      );
    case "steps":
      return (
        <>
          {b.head ? (
            <h3 className="c-sub" id={b.headId}>
              {b.head}
            </h3>
          ) : null}
          <Steps items={b.items} />
        </>
      );
    case "table":
      return <Table b={b} />;
    case "link":
      return (
        <div className="c-box">
          <LinkRow b={b} />
        </div>
      );
    case "picks":
      return b.groups.map((g) => (
        <div key={g.label}>
          <h3 className="c-sub">{g.label}</h3>
          <div>
            {g.picks.map((p) => (
              <Pick key={`${p.name}-${p.url}`} p={p} />
            ))}
          </div>
        </div>
      ));
    case "wifi":
      return (
        <>
          <h3 className="c-sub" id="wifi">
            {b.head}
          </h3>
          {b.line ? <p className="c-p">{b.line}</p> : null}
          {b.rows.map((r, i) => {
            const k = `${r.kind}-${i}`;
            return <Printed key={k} b={r} />;
          })}
        </>
      );
  }
  return null;
}

function DayLine({ c, render }: { c: DayPlan["day"][number]; render: RenderImage }) {
  return (
    <>
      <li className="c-node" id={c.id}>
        <h2 className="c-ch">
          <span className="no">{c.number}</span>
          {c.name}
        </h2>
      </li>
      {c.items.map((it, i) => {
        const k = `${it.kind}-${i}`;
        return <DayStop key={k} it={it} field={c.field} render={render} />;
      })}
    </>
  );
}

function DayStop({
  it,
  field,
  render,
}: {
  it: DayItem;
  field: DayAnswerField;
  render: RenderImage;
}): ReactNode {
  if (it.kind === "answer") return <Answer a={it} field={field} render={render} />;
  if (it.kind === "row")
    return (
      <li className="c-it" id={it.id} style={dot(field)}>
        <h3 className="c-k">{it.label}</h3>
        <div className="c-v c-vs">
          <p>
            {it.text}
            <Tail where={it.where} until={it.until} />
          </p>
        </div>
        {it.video ? (
          <div className="c-box">
            <Video v={it.video} />
          </div>
        ) : null}
      </li>
    );
  if (it.kind === "sheet")
    return (
      <li className="c-more">
        <Sheet photos={it.photos} render={render} />
      </li>
    );
  return (
    <li className="c-more">
      <Printed b={it.block} />
    </li>
  );
}

function Group({ c }: { c: RestChapter }) {
  return (
    <section
      className="c-grp"
      id={c.id}
      style={{ "--field": fieldVar(c.field) } as CSSProperties}
      aria-labelledby={`${c.id}-h`}
    >
      <h2 id={`${c.id}-h`}>
        <span className="no">{c.number}</span>
        {c.name}
      </h2>
      {c.answers.map((a) => (
        <div className="c-r" id={a.id} key={a.id}>
          <h3>{a.label}</h3>
          <p>
            {a.time ?? [a.lead, a.text].filter(Boolean).join(" ")}
            <Tail where={a.where} until={a.until} />
          </p>
          {a.steps?.length ? <Steps items={a.steps} /> : null}
        </div>
      ))}
      {c.blocks.map((b, i) => {
        const k = `${b.kind}-${i}`;
        return <Printed key={k} b={b} />;
      })}
    </section>
  );
}

/** Help on paper: the live contact line, a phone only where the brand allows one, 911 once, its rows, the colophon. */
function DayHelp({ plan, day, brand }: { plan: Plan; day: DayPlan; brand: GuideBrand }) {
  const h = plan.help;
  const qr = plan.print.wifiQr ? qrPath(plan.print.wifiQr) : undefined;
  return (
    <section className="c-help" id="help" aria-labelledby="help-h">
      <h2 id="help-h">
        <span className="no">{day.help.number}</span>
        {day.help.name}
      </h2>
      <p className="contact">{h.contact}</p>
      {h.phone ? (
        <p className="contact">
          <a href={`${h.sms ? "sms" : "tel"}:${tel(h.phone)}`}>{h.phone}</a>
        </p>
      ) : null}
      <a className="call" href="tel:911" data-tel-role="disclosure">
        <span className="big">911</span>
        <span className="t">{h.emergencies}</span>
      </a>
      {h.blocks.map((b, i) => {
        const k = `${b.kind}-${i}`;
        return <Printed key={k} b={b} />;
      })}
      <div className="colophon">
        <Wordmark brand={brand} small />
        <span>{plan.colophon.address}</span>
        <span>{plan.colophon.checked}</span>
        {plan.colophon.credits.map((c) => (
          <span key={c}>{c}</span>
        ))}
        <span className="saved" data-saved="">
          {plan.colophon.saved}
        </span>
        {qr ? (
          <svg
            className="qr"
            viewBox={`0 0 ${qr.size} ${qr.size}`}
            role="img"
            aria-label="Wi-Fi join code"
            shapeRendering="crispEdges"
          >
            <rect width={qr.size} height={qr.size} fill="#fff" />
            <path d={qr.path} fill="#000" />
          </svg>
        ) : null}
      </div>
    </section>
  );
}

/** The day line, the printed sections and Help: everything inside <main>. */
export function DayBody({
  plan,
  day,
  brand,
  render,
}: {
  plan: Plan;
  day: DayPlan;
  brand: GuideBrand;
  render: RenderImage;
}) {
  return (
    <>
      <div className="c-split">
        <div className="c-wrap">
          <ol className="c-rail" role="list">
            {day.day.map((c) => (
              <DayLine key={c.id} c={c} render={render} />
            ))}
          </ol>
        </div>
        <div className="c-rest">
          {day.rest.map((c) => (
            <Group key={c.id} c={c} />
          ))}
        </div>
      </div>
      <DayHelp plan={plan} day={day} brand={brand} />
    </>
  );
}

const CHEV_L = "M9.5 1.5 2 9l7.5 7.5";
const CHEV_R = "M1.5 1.5 9 9l-7.5 7.5";

/** The bottom rail and its Contents dialog. Hidden (and inert) until the reader is past the cover. */
export function Rail({ stops }: { stops: RailStop[] }) {
  const first = stops[0];
  const W = RAIL_WORDS;
  return (
    <>
      <nav className="rl" aria-label={W.contents} data-on="false" inert>
        <span className="rl-line" aria-hidden="true">
          <i />
        </span>
        <div className="rl-in">
          <button
            type="button"
            className="rl-where"
            aria-haspopup="dialog"
            aria-controls="rl-sheet"
          >
            <span className="rl-n" aria-hidden="true">
              {first?.num ?? ""}
            </span>
            <span className="rl-name">{first?.name ?? ""}</span>
            <span className="rl-open">
              <svg viewBox="0 0 16 12" aria-hidden="true" focusable="false">
                <path d="M0 1h16M0 6h16M0 11h16" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span className="w">{W.contents}</span>
            </span>
          </button>
          <span className="rl-step">
            <button type="button" className="rl-prev" aria-label={W.back}>
              <svg viewBox="0 0 11 18" aria-hidden="true" focusable="false">
                <path d={CHEV_L} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="rl-next" aria-label={W.next}>
              <svg viewBox="0 0 11 18" aria-hidden="true" focusable="false">
                <path d={CHEV_R} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </span>
        </div>
      </nav>
      <dialog
        className="rl-sheet"
        id="rl-sheet"
        aria-labelledby="rl-title"
        closedby="any"
        tabIndex={-1}
      >
        <div className="rl-head">
          <p className="rl-title" id="rl-title">
            {W.contents}
          </p>
          <button type="button" className="rl-x" aria-label={W.close}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M2 2l12 12M14 2 2 14" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
        <ol className="rl-list" role="list">
          {stops.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                data-stop={s.id}
                style={{ "--sw": fieldVar(s.field) } as CSSProperties}
              >
                <span className="rl-sw" aria-hidden="true" />
                <span className="n" aria-hidden="true">
                  {s.num}
                </span>
                <span className="t">{s.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </dialog>
    </>
  );
}
