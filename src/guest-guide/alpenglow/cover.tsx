import type { CSSProperties, ReactNode } from "react";
import type { GuideBrand } from "../brand";
import { type CoverPlan, type CoverRow, nameStep } from "../plan";
import { CopyButton } from "./blocks";
import { type ImageUrl, srcSet, widthsFor } from "./image";

const TIME = /^\d{1,2}:\d{2} [AP]M$/;

function hexRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * The measured shade, never above 0.35. Over the bottom `from` of the photo in
 * near-black for white facts; over the top `from` in the paper tint for ink
 * facts set in the sky. It ramps in over the first 40 percent of its zone.
 */
export function shadeOf(c: CoverPlan, paper: string): string {
  const s = c.photo?.shade;
  if (!s || s.max <= 0) return "none";
  const max = Math.min(0.35, s.max);
  const from = Math.min(1, Math.max(0, s.from));
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  if (c.layout === "high") {
    const tint = hexRgb(paper);
    return `linear-gradient(to bottom, rgba(${tint},${max}) 0%, rgba(${tint},${max}) ${pct(from * 0.6)}, rgba(${tint},0) ${pct(from)})`;
  }
  const start = 1 - from;
  return `linear-gradient(to bottom, rgba(12,14,18,0) ${pct(start)}, rgba(12,14,18,${max}) ${pct(start + from * 0.4)}, rgba(12,14,18,${max}) 100%)`;
}

export function Wordmark({ brand, small }: { brand: GuideBrand; small?: boolean }) {
  const w = brand.wordmark;
  if (w.kind === "image")
    return (
      <img
        className="lockup"
        src={w.src}
        width={w.width}
        height={w.height}
        alt={w.alt}
        decoding="async"
      />
    );
  const size = small ? 24 : 28;
  return (
    <p className={w.face === "display" ? "brand brand--display" : "brand"}>
      {brand.mark ? (
        <img src={brand.mark.src} alt="" width={size} height={size} decoding="async" />
      ) : null}
      {w.text}
    </p>
  );
}

function Value({ v }: { v?: string }) {
  if (!v) return null;
  return TIME.test(v) ? <span className="fig">{v}</span> : <span>{v}</span>;
}

function Row({ r }: { r: CoverRow }) {
  let dd: ReactNode;
  switch (r.kind) {
    case "times":
      dd = (
        <dd className="tt__times">
          <Value v={r.inValue} />
          {r.outValue ? (
            <span>
              <span className="lbl">{r.outLabel}</span>
              <Value v={r.outValue} />
            </span>
          ) : null}
        </dd>
      );
      break;
    case "wifi":
      dd = (
        <dd className="wifi" data-long={r.password && r.password.length > 24 ? "" : undefined}>
          <span className="wifi__vals">
            {r.network}
            {r.network && r.password ? <br /> : null}
            {r.password}
          </span>
          {r.password && r.copy ? <CopyButton text={r.password} label={r.copy} /> : null}
        </dd>
      );
      break;
    case "text":
      dd = <dd>{r.text}</dd>;
      break;
    case "link":
      dd = (
        <dd>
          <a className="cover__link" href={r.href}>
            {r.text}
          </a>
        </dd>
      );
      break;
  }
  const label = r.kind === "times" && !r.inValue ? r.outLabel : r.label;
  return (
    <div className="tt__row" data-essential="">
      <dt>{label}</dt>
      {dd}
    </div>
  );
}

function Facts({ c, inline }: { c: CoverPlan; inline?: boolean }) {
  return (
    <>
      <p className="cover__addr" data-essential="">
        {inline ? (c.place ?? c.address) : c.address}{" "}
        <a className="cover__link" href={c.appleMapUrl ?? c.mapUrl}>
          {c.directions}
          <span className="vh"> to {c.address}</span>
        </a>
      </p>
      <dl className="tt" style={{ "--lab": `${c.labelWidth}px` } as CSSProperties}>
        {c.rows.map((r) => (
          <Row key={r.id} r={r} />
        ))}
      </dl>
    </>
  );
}

export function Cover({
  cover: c,
  brand,
  imageUrl,
}: {
  cover: CoverPlan;
  brand: GuideBrand;
  imageUrl: ImageUrl;
}) {
  const p = c.photo;
  const lines = c.kind === "type" ? (c.typeTitle ?? [c.name]) : (c.nameLines ?? [c.name]);
  const step = c.kind === "type" ? nameStep(lines[0] ?? c.name) : c.nameStep;
  const style = {
    "--focus": p?.focus.portrait,
    "--focus-wide": p?.focus.landscape,
    "--shade": shadeOf(c, brand.fields.paper),
  } as CSSProperties;
  const high = c.layout === "high";
  return (
    <header
      className={`cover cover--${c.layout}`}
      data-hero=""
      data-name-ink={p?.nameInk ?? "ink"}
      data-facts-ink={p?.factsInk ?? "ink"}
      style={style}
    >
      {p ? (
        <>
          <picture className="cover__photo">
            {p.wide ? (
              <source
                media="(min-width: 700px)"
                srcSet={
                  srcSet(p.wide.src, widthsFor(p.wide.width, [1600, 2400]), imageUrl) ??
                  imageUrl(p.wide.src, 2400)
                }
                sizes="100vw"
                width={p.wide.width}
                height={p.wide.height}
              />
            ) : null}
            <img
              src={imageUrl(p.portrait.src, 1170)}
              srcSet={srcSet(p.portrait.src, [828, 1170], imageUrl)}
              sizes="100vw"
              width={p.portrait.width}
              height={p.portrait.height}
              alt={p.alt}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="cover__shade" aria-hidden="true" />
        </>
      ) : null}
      <div className="cover__sky">
        <Wordmark brand={brand} />
        <p className="notice" role="status">
          {c.notice ?? ""}
        </p>
        <h1 className="cover__name" style={{ "--name": step } as CSSProperties}>
          {c.kind === "type" ? (
            <>
              <span>{lines[0]}</span>
              {lines.length > 1 ? (
                <span className="type-title">
                  {lines.slice(1).map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </span>
              ) : null}
            </>
          ) : lines.length > 1 ? (
            lines.map((l) => <span key={l}>{l}</span>)
          ) : (
            lines[0]
          )}
        </h1>
        {c.feature ? <p className="type-feature">{c.feature}</p> : null}
        {high ? <Facts c={c} inline /> : null}
      </div>
      {high ? null : (
        <div className="cover__ground">
          <Facts c={c} />
        </div>
      )}
    </header>
  );
}
