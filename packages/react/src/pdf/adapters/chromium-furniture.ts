/**
 * How page furniture reaches a Chromium page.
 *
 * Chromium repeats a header and a footer on every printed page through its own
 * print templates, and it fills the text of any element whose class list names
 * `pageNumber` or `totalPages`. That is this engine's per-page mechanism, so
 * the running head and the foot ride it. A page-number component marks its
 * slots with `data-page-counter`, and this module translates those marks into
 * the class hooks the templates read, which is the same translation the takumi
 * path makes into its own hooks. Nothing in a component names an engine.
 *
 * A template is a document of its own. It inherits no stylesheet from the page
 * it is printed on, so each band is sent with the page's whole stylesheet
 * inlined: the compiled Tailwind, the application CSS, and the document's faces
 * as `data:` URIs, because a template loads nothing from disk. The band is then
 * placed at the inset from the paper's edge that the preview and the default
 * engine use, and indented to the document's margin, so all three outputs draw
 * it in the same place.
 *
 * A template covers only the margin, so the stamp cannot ride one the way it
 * rides takumi's header band. It is printed as a fixed-position layer inside
 * the document instead, which Blink repeats on every printed page, sized to the
 * whole sheet and set behind the content. It takes no room in the flow, so the
 * page plan and the page count are what they are without it.
 *
 * Every band is measured in the printed document before the print, with the
 * document's own faces and images, and a band taller than the margin is refused
 * by name. The template would clip it rather than reflow the page.
 */

import { renderToStaticMarkup } from "react-dom/server";

import {
  assertFurnitureBandFits,
  FURNITURE_EDGE_INSET_PX,
  PAGE_COUNTER_ATTRIBUTE,
  UnsupportedFurnitureContentError,
  type FurnitureBandSlot,
  type PageCounter,
  type PageFurniture,
} from "../../lib/furniture";
import type { PdfPageGeometry } from "../adapter";

/** The class Chromium's print templates fill with each counter a component marked. */
export const CHROMIUM_COUNTER_CLASS: Record<PageCounter, string> = {
  current: "pageNumber",
  total: "totalPages",
};

/** Every declared slot, as the markup the printed page carries. */
export interface FurnitureMarkup {
  /** The top band's content. */
  header?: string;
  /** The bottom band's content. */
  footer?: string;
  /** The whole-sheet layer's content. */
  stamp?: string;
}

/**
 * Every declared slot, rendered to markup.
 *
 * @throws {UnsupportedFurnitureContentError} when the stamp carries a page
 * counter. The stamp is printed inside the document, where Chromium fills no
 * counter, so every page would print the same number.
 */
export function furnitureMarkup(furniture: PageFurniture | undefined): FurnitureMarkup {
  if (furniture === undefined) return {};
  const markup: FurnitureMarkup = {};
  if (furniture.header !== undefined) markup.header = renderToStaticMarkup(furniture.header);
  if (furniture.footer !== undefined) markup.footer = renderToStaticMarkup(furniture.footer);
  if (furniture.stamp !== undefined) {
    markup.stamp = renderToStaticMarkup(furniture.stamp);
    if (markup.stamp.includes(`${PAGE_COUNTER_ATTRIBUTE}=`)) {
      throw new UnsupportedFurnitureContentError(
        "chromium",
        "stamp",
        "a page counter",
        "The stamp is printed inside the document, where Chromium fills no counter, so " +
          "every page would carry the same number. Put the page number in the header or the footer."
      );
    }
  }
  return markup;
}

/**
 * The stamp's layer, as markup inside the printed document.
 *
 * A fixed element is repeated on every printed page and placed against the
 * page's content box, so the layer is pulled back out by the margin to cover
 * the whole sheet, the way the preview's layer covers the whole sheet. It sits
 * below the content, as the preview's does, so the watermark is behind the
 * text rather than over it.
 */
export function stampLayer(markup: string, geometry: PdfPageGeometry): string {
  const style = [
    "position: fixed",
    `top: ${-geometry.marginPx}px`,
    `left: ${-geometry.marginPx}px`,
    `width: ${geometry.widthPx}px`,
    `height: ${geometry.heightPx}px`,
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "z-index: -1",
    "pointer-events: none",
  ].join("; ");
  return `<div data-page-stamp="true" style="${style}">${markup}</div>`;
}

/** One band to prepare in the page, by slot. */
export interface BandInput {
  /** The margin it is drawn in. */
  slot: FurnitureBandSlot;
  /** Its content, as markup. */
  html: string;
}

/** One band as the page laid it out: hooked, its images inlined, and measured. */
export interface PreparedBand {
  /** The margin it is drawn in. */
  slot: FurnitureBandSlot;
  /** Its content, with counter hooks and `data:` images, ready for a template. */
  html: string;
  /** The height it laid out to at the page's width, in CSS pixels. */
  heightPx: number;
}

/** What preparing the bands turned up. */
export interface PreparedBands {
  /** The bands, in the order they were given. */
  bands: PreparedBand[];
  /** Image `src` values in a band the render supplied no bytes for. */
  missingImages: string[];
  /**
   * The printed document's root font size, in CSS pixels.
   *
   * A template's root is not the document's and Chromium sets it far smaller,
   * so a band sized in `rem` would print a fraction of the size the preview
   * draws it at. The template is given the document's own.
   */
  rootFontSizePx: number;
}

/** What the in-page pass needs, since it shares no scope. */
export interface PrepareBandsSettings {
  /** The paper's width, which is the width a band is laid out at. */
  widthPx: number;
  /** The document's margin, which a band is indented by. */
  marginPx: number;
  /** The attribute a counter slot is marked with. */
  counterAttribute: string;
  /** The class each counter is hooked to. */
  counterClasses: Record<string, string>;
}

/**
 * Runs inside the page: lays every band out in the printed document, measures
 * it, hooks its counters, and inlines its images.
 *
 * Measured here rather than in a template because this document carries the
 * faces, the images and the stylesheet the band will be drawn with, and a band
 * measured against anything else is measured wrong. It is one self-contained
 * function because `page.evaluate` sends its source to the browser.
 */
export async function prepareBandsInPage(
  bands: BandInput[],
  images: Record<string, string>,
  settings: PrepareBandsSettings
): Promise<PreparedBands> {
  const missingImages: string[] = [];
  const hosts = bands.map((band) => {
    const host = document.createElement("div");
    host.className = "paradoc-document";
    host.style.cssText = [
      "position: absolute",
      "left: 0",
      "top: 0",
      "visibility: hidden",
      "box-sizing: border-box",
      `width: ${settings.widthPx}px`,
      `padding-left: ${settings.marginPx}px`,
      `padding-right: ${settings.marginPx}px`,
    ].join("; ");
    host.innerHTML = band.html;
    document.body.append(host);
    for (const image of [...host.querySelectorAll("img")]) {
      const src = image.getAttribute("src") ?? "";
      const supplied = images[src];
      if (supplied !== undefined) image.setAttribute("src", supplied);
      else if (!src.startsWith("data:") && !missingImages.includes(src)) missingImages.push(src);
    }
    return { slot: band.slot, host };
  });

  await document.fonts.ready;
  await Promise.all(
    hosts.flatMap(({ host }) =>
      [...host.querySelectorAll("img")].map(async (image) => {
        if (image.complete) return;
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    )
  );

  const prepared = hosts.map(({ slot, host }) => {
    const heightPx = host.getBoundingClientRect().height;
    for (const slotElement of [...host.querySelectorAll(`[${settings.counterAttribute}]`)]) {
      const hook = settings.counterClasses[slotElement.getAttribute(settings.counterAttribute) ?? ""];
      if (hook !== undefined) slotElement.classList.add(hook);
    }
    const html = host.innerHTML;
    host.remove();
    return { slot, html, heightPx };
  });

  const rootFontSizePx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { bands: prepared, missingImages, rootFontSizePx };
}

/**
 * Fails unless every band fits inside the margin it is drawn in.
 *
 * @throws {PageFurnitureOverflowError} naming the slot, its height and the margin.
 */
export function assertBandsFit(bands: readonly PreparedBand[], geometry: PdfPageGeometry): void {
  for (const band of bands) {
    assertFurnitureBandFits(band.slot, Math.ceil(band.heightPx), geometry.marginPx);
  }
}

/** What a band's template is written against. */
export interface BandTemplateOptions {
  /** The page's stylesheet, without its page box, with every face inlined. */
  css: string;
  /** The page both outputs are measured against. */
  geometry: PdfPageGeometry;
  /** The document's language. */
  lang: string;
  /** Which way the document's lines run. */
  dir: string;
  /** The printed document's root font size, which `rem` in a band resolves against. */
  rootFontSizePx: number;
}

/**
 * An empty template.
 *
 * Chromium prints its own date, title and URL in a template it is not given,
 * so a document with a header and no footer is sent an empty footer rather
 * than none.
 */
export const EMPTY_TEMPLATE = "<span></span>";

/**
 * One band as a print template: the page's stylesheet, and the band placed at
 * the inset from the paper's edge the other outputs draw it at.
 *
 * The template's own box is the whole sheet, so the band is positioned against
 * the sheet's edge. Colour adjustment is turned off, because a template prints
 * in economy mode by default and would drop a band's background and lighten its
 * text.
 */
export function bandTemplate(
  slot: FurnitureBandSlot,
  html: string | undefined,
  options: BandTemplateOptions
): string {
  if (html === undefined) return EMPTY_TEMPLATE;
  const { geometry } = options;
  const edge = slot === "header" ? "top" : "bottom";
  const style = [
    "position: absolute",
    `${edge}: ${FURNITURE_EDGE_INSET_PX}px`,
    "left: 0",
    "right: 0",
    "box-sizing: border-box",
    `padding-left: ${geometry.marginPx}px`,
    `padding-right: ${geometry.marginPx}px`,
  ].join("; ");
  return [
    "<style>",
    options.css,
    `html { font-size: ${options.rootFontSizePx}px; }`,
    "html, body { margin: 0; padding: 0; background: transparent; " +
      "-webkit-print-color-adjust: exact; print-color-adjust: exact; }",
    "</style>",
    `<div class="paradoc-document" lang="${options.lang}" dir="${options.dir}" ` +
      `data-page-${slot}="true" style="${style}">${html}</div>`,
  ].join("\n");
}
