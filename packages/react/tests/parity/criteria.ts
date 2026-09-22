/**
 * What the parity suites share: the capture resolution, the thresholds a page
 * is held to, and the way a page is identified on either side.
 *
 * Two suites measure against these, the document variants and the furnished
 * document, and a threshold or a matching rule that drifted between them would
 * hold one output to a different standard than the other.
 */

import type { ReadPage } from "../pdf-reader";
import { normalizeText, type TreeKeep } from "../tree-keeps";
import type { PreviewPlan } from "./preview";

/**
 * How much larger than the paper both sides are drawn before being averaged
 * down to it.
 *
 * Chrome paints the preview's text and pdf.js paints the PDF's, and no two text
 * rasterizers antialias an outline identically. Drawing both at twice the size
 * and averaging each 2 x 2 square into one pixel puts most of that difference
 * back where it belongs — below the resolution the comparison is defined at —
 * and leaves the geometry, which is what the criterion is about.
 */
export const CAPTURE_SCALE = 2;

/**
 * How much of a page may still differ once each band has been aligned.
 *
 * This is the two layouts disagreeing. What it excludes is the two text
 * rasterizers, which on these pages account for three to four and a half
 * percent and are not a property of either document.
 */
export const RESIDUAL_THRESHOLD_PERCENT = 5;

/**
 * How far a band may sit from its counterpart before the two pages are not the
 * same page. Eight pixels is under a quarter of a table row, so a page inside
 * it holds the same content on the same lines.
 */
export const DRIFT_LIMIT_PX = 8;

/**
 * The keep a PDF page starts on, read back from the page's own text.
 *
 * The PDF is bytes and text; it publishes no keep map. So a page is identified
 * the only way it can be: the keep whose text the page's text begins with. A
 * continued page in hint mode opens with the copied table header, which is not
 * that page's keep, so a header match is stripped and the search goes on. The
 * longest match wins, because a short field's text can be the start of a longer
 * keep's and only one of the two can be the keep that opens the page.
 */
export function pdfFirstKeeps(pages: readonly ReadPage[], keeps: readonly TreeKeep[]): (string | null)[] {
  const candidates = keeps
    .map((keep) => ({ ...keep, text: normalizeText(keep.text) }))
    .filter((keep) => keep.text.length > 0);

  return pages.map((page) => {
    let text = normalizeText(page.text);
    // One header copy is possible, one is enough; the guard keeps a pathological
    // match from looping rather than reporting nothing.
    for (let attempt = 0; attempt < 4; attempt++) {
      const matches = candidates
        .filter((keep) => text.startsWith(keep.text))
        .sort((a, b) => b.text.length - a.text.length);
      const best = matches[0];
      if (best === undefined) return null;
      if (!best.tableHeader) return best.id;
      text = text.slice(best.text.length);
    }
    return null;
  });
}

/**
 * The first keep of each preview page that a PDF page could be identified by.
 *
 * The preview's own first keep can be the masthead's logo, which carries no
 * text and therefore has no counterpart to find in a PDF. Both sides are read
 * the same way instead: past the repeated header copies, to the first keep
 * that carries text.
 *
 * The search is bounded to the page's own keeps. Walking document order from
 * the page's first keep instead would run off the end of the page and answer
 * with a keep that is on the next one, which is exactly the mismatch this
 * criterion exists to catch.
 */
export function previewFirstKeeps(plan: PreviewPlan, keeps: readonly TreeKeep[]): (string | null)[] {
  const texted = new Set(
    keeps.filter((keep) => normalizeText(keep.text).length > 0).map((keep) => keep.id)
  );

  return plan.pageKeeps.map((ownKeeps) => ownKeeps.find((id) => texted.has(id)) ?? null);
}
