/**
 * The document typeface, named once.
 *
 * The preview loads these files through `styles.css`; the PDF embeds the same
 * files in the PDF. Neither side may name a different family.
 */

/** npm package the font files come from. */
export const DOCUMENT_FONT_PACKAGE = "@fontsource-variable/inter";

/** CSS family stack applied to the sheet. */
export const DOCUMENT_FONT_FAMILY = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

/** The family name on its own, for an engine that takes one name. */
export const DOCUMENT_FONT_NAME = "Inter Variable";
