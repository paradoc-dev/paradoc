/**
 * The paper and typeface a document is actually being drawn with, as context.
 *
 * It lives in a module of its own because three things need it and two of them
 * would otherwise import each other: `Paper` and `Pages` supply it from the
 * document element they were handed, `Sheet` reads it to size itself, and the
 * document root reads it to check that what it resolved is what is being drawn.
 *
 * `renderPdf` supplies the same context around the element it hands an adapter.
 * That is not decoration: the check below is the only thing standing between a
 * composition whose tokens the element walk could not see and a PDF that
 * silently comes out on the wrong paper in the wrong face, and a check that ran
 * only in the browser would miss every server render — which is every render a
 * React layer performs.
 */

import { createContext, useContext } from "react";

import {
  pageGeometry,
  resolveDocumentTokens,
  type DocumentTokens,
  type PageGeometry,
} from "../lib/tokens";

/** The unbranded paper, as the geometry both outputs measure against. */
export const DEFAULT_PAGE_GEOMETRY: PageGeometry = pageGeometry(resolveDocumentTokens());

/** What the furniture, or `renderPdf`, resolved before the document rendered. */
export interface DrawnPaper {
  /** The whole resolved set, so the root can compare every token it owns. */
  tokens: DocumentTokens;
  /** That set's geometry, resolved once rather than by each `Sheet`. */
  geometry: PageGeometry;
}

const DrawnPaperContext = createContext<DrawnPaper | null>(null);

/** Supplies what every `Sheet` below is drawn with. Internal to the furniture and the PDF path. */
export const DrawnPaperProvider = DrawnPaperContext.Provider;

/** The resolved set and geometry for one document element. */
export function drawnPaper(tokens: DocumentTokens): DrawnPaper {
  return { tokens, geometry: pageGeometry(tokens) };
}

/**
 * The paper the sheet around this component is drawn on.
 *
 * Outside `Pages` and `Paper` it is the unbranded default, so a `Sheet` used on
 * its own is still a sheet of paper.
 */
export function usePaperGeometry(): PageGeometry {
  return useContext(DrawnPaperContext)?.geometry ?? DEFAULT_PAGE_GEOMETRY;
}

/**
 * What the document is being drawn with, or `null` when nothing decided.
 *
 * The document root needs to tell "nothing above me resolved a paper" from "a
 * paper that happens to be the default", because only the first is not a
 * disagreement.
 */
export function useDrawnPaper(): DrawnPaper | null {
  return useContext(DrawnPaperContext);
}
