/**
 * The organization mark on the proposal masthead, named once.
 *
 * The engine fetches nothing, so an image reaches it as bytes keyed by the
 * `src` string in the tree. The preview needs a `src` a browser can load. The
 * two therefore agree on the key rather than on the URL: `PROPOSAL_LOGO_SRC` is
 * the default and the key the PDF path supplies bytes under, and a caller that
 * has a real URL — the lab, which lets Vite resolve the PNG — passes it as
 * `logoSrc` instead.
 *
 * The PNG itself lives at `src/examples/proposal-logo.png` and is the one
 * source for both outputs.
 */

/** Stable key for the proposal's organization mark. */
export const PROPOSAL_LOGO_SRC = "paradoc-react:proposal-logo.png";

/** Rendered width in CSS pixels. The engine needs explicit dimensions. */
export const PROPOSAL_LOGO_WIDTH_PX = 40;

/** Rendered height in CSS pixels. */
export const PROPOSAL_LOGO_HEIGHT_PX = 40;
