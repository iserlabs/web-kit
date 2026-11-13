/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { CSSProperties } from "react";
import type { GuideBrand } from "../brand";
import type { Plan } from "../plan";
import { Blocks } from "./blocks";
import { ChapterLabel, fieldVar } from "./chapter";
import { Wordmark } from "./cover";
import type { RenderImage } from "./image";
import { qrPath } from "./print-qr";

const tel = (phone: string) => phone.replace(/[^\d+]/g, "");

/**
 * Help on paper: the live contact line, a phone only where the brand allows
 * one, 911 exactly once, then the colophon with the reserved saved line.
 */
export function Help({
  plan,
  brand,
  render,
}: {
  plan: Plan;
  brand: GuideBrand;
  render: RenderImage;
}) {
  const h = plan.help;
  const qr = plan.print.wifiQr ? qrPath(plan.print.wifiQr) : undefined;
  return (
    <section
      className="help"
      id="help"
      style={{ "--prev": fieldVar(h.prevField) } as CSSProperties}
      aria-labelledby="help-h"
    >
      <ChapterLabel c={h} />
      <h2 className="q" id="help-h">
        {h.head.text}
      </h2>
      <p className="contact">{h.contact}</p>
      {h.phone ? (
        <p className="reach">
          <a href={`${h.sms ? "sms" : "tel"}:${tel(h.phone)}`}>{h.phone}</a>
        </p>
      ) : null}
      <a className="call" href="tel:911">
        <span className="big">911</span>
        <span className="t">{h.emergencies}</span>
      </a>
      <Blocks blocks={h.blocks} render={render} />
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
