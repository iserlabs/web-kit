import type { CSSProperties } from "react";
import { XENIA_GOLD_X } from "./mark";
import { XENIA_CREDIT_CSS } from "./styles";

export { XENIA_GOLD_X } from "./mark";
export { XENIA_CREDIT_CSS } from "./styles";

/**
 * The footer credit every member site carries, "Gold signature" (Jake's board pick, 2026-11-19):
 * the gold X, "Powered by" in the host footer's own face and color, then the name in Xenia's own
 * serif. No trailing period: it is a link label like the footer's other links.
 *
 * The name's serif is Cormorant Garamond 500, the xenia.host wordmark face. Load it in the site
 * (next/font, latin, weight 500) and hand it over as `--xc-serif`; Georgia stands in until then.
 */
export const XENIA_CREDIT = {
  by: "Powered by",
  name: "Xenia Hospitality Operations",
  href: "https://xenia.host",
} as const;

export interface XeniaCreditProps {
  /** Member slug for the `?ref=` the fleet already uses, e.g. "sunmountainstays". */
  refId?: string;
  /** Color of the name. Defaults to the link's own color. */
  fg?: string;
  /** Color of "Powered by". Defaults to the surrounding text color. */
  muted?: string;
  /** Hover underline. Deeper gold (#8a6a2c) on light footers, lighter (#d2b47a) on dark ones. */
  gold?: string;
  /** Keyboard focus ring. Defaults to the link color. */
  ring?: string;
  /** Size of "Powered by". Defaults to 14px; never under 13px. */
  size?: string;
  className?: string;
  /** Open xenia.host in a new tab, as the fleet's footer links already do. */
  newTab?: boolean;
}

export function xeniaCreditHref(refId?: string): string {
  return refId ? `${XENIA_CREDIT.href}?ref=${encodeURIComponent(refId)}` : XENIA_CREDIT.href;
}

export function XeniaCredit({
  refId,
  fg,
  muted,
  gold,
  ring,
  size,
  className,
  newTab = true,
}: XeniaCreditProps) {
  const vars: Record<string, string> = {};
  if (fg) vars["--xc-fg"] = fg;
  if (muted) vars["--xc-muted"] = muted;
  if (gold) vars["--xc-gold"] = gold;
  if (ring) vars["--xc-ring"] = ring;
  if (size) vars["--xc-size"] = size;
  return (
    <>
      <style href="iserlabs-xenia-credit" precedence="default">
        {XENIA_CREDIT_CSS}
      </style>
      <a
        className={className ? `xc ${className}` : "xc"}
        href={xeniaCreditHref(refId)}
        style={vars as CSSProperties}
        {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
      >
        <img className="xc__x" src={XENIA_GOLD_X} alt="" width={20} height={18} decoding="async" />
        <span className="xc__by">{XENIA_CREDIT.by}</span>
        <span className="xc__name">{XENIA_CREDIT.name}</span>
      </a>
    </>
  );
}
