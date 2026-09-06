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

import type { TextDirection } from "../lib/script";
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
  /** Which way the document's lines run, written to the document root. */
  dir: TextDirection;
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
  /**
   * The writing directions this engine was **measured** to lay out, not the
   * ones it is expected to.
   *
   * Direction is not a property of the text: it decides which edge a line
   * starts on and which end of a row the first column sits at. An engine that
   * has no `direction` still draws every glyph, so a right-to-left document
   * comes out looking merely wrong rather than failing, which is the silent
   * loss this package exists to rule out. So the capability is declared beside
   * the engine that has it and `renderPdf` refuses the pairing it cannot make.
   */
  readonly directions: readonly TextDirection[];
  /** Writes the PDF, and reports every hint the tree could not honour. */
  render(input: PreparedPdfInput, options: PdfAdapterOptions): Promise<PdfRenderResult>;
}

/** A document whose writing direction the chosen engine does not lay out. */
export class UnsupportedDirectionError extends Error {
  /** The engine that was asked. */
  readonly adapter: PdfAdapterName;
  /** The direction the document needs. */
  readonly direction: TextDirection;
  /** The script it is written in, as an ISO 15924 code. */
  readonly script: string;
  /** The language tag that script was read from. */
  readonly lang: string;
  /** The directions the engine does lay out. */
  readonly directions: readonly TextDirection[];

  constructor(
    adapter: PdfAdapterName,
    direction: TextDirection,
    script: string,
    lang: string,
    directions: readonly TextDirection[]
  ) {
    super(
      `The "${adapter}" adapter cannot lay a document out ${direction === "rtl" ? "right to left" : "left to right"}, ` +
        `and this document is written in ${script} (lang="${lang}", dir="${direction}"). ` +
        `It lays out ${directions.join(" and ")} only. Rendering it anyway would put every ` +
        "line on the wrong edge and every row's first column at the wrong end, which is a " +
        "document that looks wrong rather than a render that failed. Choose an adapter " +
        "that declares the direction.",
    );
    this.name = "UnsupportedDirectionError";
    this.adapter = adapter;
    this.direction = direction;
    this.script = script;
    this.lang = lang;
    this.directions = directions;
  }
}

/**
 * Fails unless the engine lays out the direction the document is written in.
 *
 * Takes the capability rather than the whole adapter, so the check is the same
 * function whether it is asked about a resolved engine or about the declaration
 * a new one makes.
 *
 * @throws {UnsupportedDirectionError} naming the adapter and the script.
 */
export function assertDirectionSupported(
  adapter: Pick<PdfAdapter, "name" | "directions">,
  direction: TextDirection,
  script: string,
  lang: string
): void {
  if (!adapter.directions.includes(direction)) {
    throw new UnsupportedDirectionError(
      adapter.name,
      direction,
      script,
      lang,
      adapter.directions
    );
  }
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
