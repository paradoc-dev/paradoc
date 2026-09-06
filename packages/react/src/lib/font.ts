/**
 * The document typefaces, named once.
 *
 * The preview loads these files through `styles.css`; the PDF embeds the same
 * files in the PDF. Neither side may name a different family, and neither side
 * may name a family that is not here: a face the browser can fall back to is a
 * face the engine writes as null glyphs, which is exactly the silent loss this
 * package rules out. So a family is either registered — files, subsets, weights,
 * a CSS stack — or naming it fails.
 *
 * A registration is deliberately not a font loader. It is the engine-neutral
 * description of one family, read by `src/pdf/resources.ts` for the file paths
 * and by the tokens for the CSS stack the browser applies.
 */

/** One family a document may name, with everything both outputs need to reach it. */
export interface FontFamilyRegistration {
  /** The name a document's tokens ask for it by, and the family the faces declare. */
  name: string;
  /** CSS family stack applied to the sheet, with the fallbacks the browser needs. */
  stack: string;
  /** npm package the font files come from. */
  package: string;
  /**
   * The fontsource subsets to embed, as its `unicode.json` keys them.
   *
   * The *set* has to match what the stylesheet loads, not the order: a face the
   * preview has and the PDF lacks renders as null glyphs on paper with no error
   * at all. Order is immaterial because every face carries its own
   * `unicode-range`, so coverage decides which face a codepoint reaches.
   */
  subsets: readonly string[];
  /** The file within the package that carries one subset. */
  file: (subset: string) => string;
  /** The weights every face carries, in CSS `font-weight` syntax. */
  weight: string;
  /**
   * The generic family an engine falls back to when it cannot reach a face.
   *
   * The engine takes a family list rather than a stack, so it gets this rather
   * than `stack`. It is per family because a serif that fell back to a sans is
   * a different document, and reading it from the registration is what stops
   * the adapter from hard-coding one.
   */
  fallback: string;
}

/** npm package the default typeface's files come from. */
export const DOCUMENT_FONT_PACKAGE = "@fontsource-variable/inter";

/** CSS family stack applied to the sheet by default. */
export const DOCUMENT_FONT_FAMILY = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

/** The default family name on its own, for an engine that takes one name. */
export const DOCUMENT_FONT_NAME = "Inter Variable";

/** The serif family a document may brand itself with. */
export const SERIF_FONT_NAME = "Source Serif 4 Variable";

/**
 * The families a document may name.
 *
 * Two, because a token that can only hold one value proves nothing: the second
 * is what shows a tenant's family reaching both outputs. Adding a third is a
 * package change — a dependency, a `@import` in `styles.css`, and an entry
 * here — rather than something a caller can do from the outside, because the
 * files have to travel with the package for the PDF to embed them.
 */
export const DOCUMENT_FONT_FAMILIES: readonly FontFamilyRegistration[] = [
  {
    name: DOCUMENT_FONT_NAME,
    stack: DOCUMENT_FONT_FAMILY,
    package: DOCUMENT_FONT_PACKAGE,
    subsets: ["cyrillic-ext", "cyrillic", "greek-ext", "greek", "latin-ext", "latin", "vietnamese"],
    file: (subset) => `${DOCUMENT_FONT_PACKAGE}/files/inter-${subset}-wght-normal.woff2`,
    weight: "100 900",
    fallback: "sans-serif",
  },
  {
    name: SERIF_FONT_NAME,
    stack: '"Source Serif 4 Variable", ui-serif, Georgia, serif',
    package: "@fontsource-variable/source-serif-4",
    subsets: ["cyrillic-ext", "cyrillic", "greek", "latin-ext", "latin", "vietnamese"],
    file: (subset) =>
      `@fontsource-variable/source-serif-4/files/source-serif-4-${subset}-wght-normal.woff2`,
    weight: "200 900",
    fallback: "serif",
  },
];

/** Thrown when a document names a family this package cannot embed. */
export class UnregisteredFontFamilyError extends Error {
  /** The family the document asked for. */
  readonly family: string;
  /** The families it could have asked for. */
  readonly registered: readonly string[];

  constructor(family: string) {
    const registered = DOCUMENT_FONT_FAMILIES.map((entry) => entry.name);
    super(
      `The document names the font family "${family}", which @paradoc/react does not ` +
        "register. The PDF embeds the files the preview loads, so a family with no files " +
        "in the package would render as null glyphs on paper rather than as a fallback. " +
        `Name one of: ${registered.map((name) => `"${name}"`).join(", ")}.`
    );
    this.name = "UnregisteredFontFamilyError";
    this.family = family;
    this.registered = registered;
  }
}

/**
 * The registration for one family.
 *
 * @throws {UnregisteredFontFamilyError} when the family is not registered.
 */
export function documentFontFamily(name: string): FontFamilyRegistration {
  const found = DOCUMENT_FONT_FAMILIES.find((entry) => entry.name === name);
  if (found === undefined) throw new UnregisteredFontFamilyError(name);
  return found;
}
