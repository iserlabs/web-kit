/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ReactNode } from "react";
import { COVER_WIDTH, PHONE_WIDTH } from "../plan";

/** One image the guide places. `widths` are the srcset candidates; the phone width is always one. */
export type GuideImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  widths: number[];
  priority?: boolean;
  className?: string;
};

/** A site's image renderer (next/image on the Next sites). It must offer `imageUrl(src, w)` for each width. */
export type RenderImage = (img: GuideImage) => ReactNode;

/** The URL of a photo at a width. The default serves the file as it is. */
export type ImageUrl = (src: string, width: number) => string;

export const identityUrl: ImageUrl = (src) => src;

/** srcset candidates: the house's own steps up to the file's width, plus the phone width the offline save uses. */
export function widthsFor(
  width: number,
  base: number[] = [414, PHONE_WIDTH, COVER_WIDTH, 1600, 2400],
) {
  return [...new Set([...base.filter((w) => w <= width), PHONE_WIDTH])].sort((a, b) => a - b);
}

export function srcSet(src: string, widths: number[], url: ImageUrl): string | undefined {
  const urls = widths.map((w) => [url(src, w), w] as const);
  if (new Set(urls.map(([u]) => u)).size <= 1) return undefined;
  return urls.map(([u, w]) => `${u} ${w}w`).join(", ");
}

/** The kit default: a plain <img> with srcset, lazy unless it is the cover. */
export function defaultImage(url: ImageUrl): RenderImage {
  return function GuideImg(img) {
    const set = srcSet(img.src, img.widths, url);
    return (
      <img
        className={img.className}
        src={url(img.src, PHONE_WIDTH)}
        srcSet={set}
        sizes={set ? img.sizes : undefined}
        width={img.width}
        height={img.height}
        alt={img.alt}
        loading={img.priority ? undefined : "lazy"}
        fetchPriority={img.priority ? "high" : undefined}
        decoding="async"
      />
    );
  };
}
