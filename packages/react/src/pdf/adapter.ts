/**
 * The seam between one call and the engine that answers it.
 *
 * `renderPdf` is the whole PDF surface, and its first engine was takumi.
 * A second engine is not a second call: a document that needs a different
 * renderer is still the same tree, the same plan, the same fonts and the same
 * page. So what an adapter is handed is exactly the part of a render that has
 * no engine in it — `PreparedPdfInput` — and what it returns is the result the
 * one call has always returned.
 *
 * Nothing here loads an engine. Both adapters are modules of their own, and
 * `render.ts` reaches the Chromium one through a dynamic import so the package
 * entry never pulls a browser driver in behind it.
 */

import type { ReactNode } from "react";

import type { DocumentTokens } from "../lib/tokens";
import type { PdfFontFile, PdfImage } from "./resources";
import type { PageBreakPlan } from "./tree";

/** Which engine writes the bytes. */
export type PdfAdapterName = "takumi" | "chromium";

/**
 * The page, in the CSS pixels `Paper` exports.
 *
 * It travels with the input rather than being read by each adapter, because
 * the two outputs agreeing about paper is the invariant the parity suite measures and
 * a geometry each engine looked up for itself could drift.
 */
export interface PdfPageGeometry {
  /** Sheet width. */
  widthPx: number;
  /** Sheet height. */
  heightPx: number;
  /** Margin on all four sides of every page. */
  marginPx: number;
}

/** Everything a render is, before an engine is chosen. */
export interface PreparedPdfInput {
  /** The composed document. Components, not markup: every engine resolves it itself. */
  element: ReactNode;
  /**
   * The document's resolved branding.
   *
   * It travels with the input for the reason the geometry does: the typeface is
   * a name each engine has to be told, and a family each adapter looked up for
   * itself could drift from the one the preview loaded.
   */
  tokens: DocumentTokens;
  /** The preview's page plan. Absent, the engine paginates on its own. */
  plan?: PageBreakPlan;
  /** Pre-fetched bytes for every image the tree names. */
  images: readonly PdfImage[];
  /** The faces to embed, as files, in the order they are declared. */
  fonts: readonly PdfFontFile[];
  /** The page both outputs are measured against. */
  geometry: PdfPageGeometry;
}

/** What a render carries that is not the document. */
export interface PdfAdapterOptions {
  /** BCP-47 language written to the document. */
  lang: string;
  /** True when the tree carries the seal flow's invisible marker codepoints. */
  signingMarkers: boolean;
}

/** The bytes, and what the render could not honour. */
export interface PdfRenderResult {
  /** The PDF. */
  bytes: Uint8Array;
  /**
   * Planned breaks that named a keep the tree does not contain. The engine
   * paginated from that point itself; the specification requires the
   * divergence to be reported rather than swallowed.
   */
  unknownBreaks: string[];
  /**
   * Planned header copies that named a keep the tree does not contain. The
   * page opened without that copy; the divergence is reported for the same
   * reason a stale break is.
   */
  unknownRepeats: string[];
}

/** One engine behind `renderPdf`. */
export interface PdfAdapter {
  /** The name a caller asks for it by. */
  readonly name: PdfAdapterName;
  /** Writes the PDF, and reports every hint the tree could not honour. */
  render(input: PreparedPdfInput, options: PdfAdapterOptions): Promise<PdfRenderResult>;
}

/** What the render refused, with every offender named. */
export class UnsupportedPdfContentError extends Error {
  /** Classes outside the verified vocabulary, in document order. */
  readonly classes: readonly string[];
  /** Image `src` values with no usable bytes, in document order. */
  readonly images: readonly string[];

  constructor(classes: readonly string[], images: readonly string[]) {
    super(describe(classes, images));
    this.name = "UnsupportedPdfContentError";
    this.classes = classes;
    this.images = images;
  }
}

function describe(classes: readonly string[], images: readonly string[]): string {
  const parts: string[] = [];
  if (classes.length > 0) {
    parts.push(
      `${classes.length} Tailwind ${classes.length === 1 ? "class the" : "classes the"} PDF renderer does not support: ${classes.join(", ")}`
    );
  }
  if (images.length > 0) {
    parts.push(
      `${images.length} ${images.length === 1 ? "image with no usable bytes" : "images with no usable bytes"}: ${images.join(", ")}`
    );
  }
  return `The document cannot be rendered to PDF. ${parts.join("; ")}.`;
}
