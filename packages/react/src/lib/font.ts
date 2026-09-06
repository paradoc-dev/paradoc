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
  /**
   * The scripts this family carries glyphs for, as ISO 15924 codes.
   *
   * The document's language decides which script it is written in, and a family
   * that carries no glyphs for that script is not a fallback: the engine writes
   * a null glyph for every codepoint it cannot reach and says nothing, which is
   * the same silent loss an unregistered family would be. So the coverage is
   * declared here beside the subsets it comes from, and naming a language this
   * family cannot set fails.
   *
   * Read from the subsets rather than guessed: `latin` and `latin-ext` are
   * `Latn`, `cyrillic` is `Cyrl`, `greek` is `Grek`, `arabic` is `Arab`. A
   * subset that carries no letters of its own — `math`, `symbols` — names no
   * script.
   */
  scripts: readonly string[];
}

/** npm package the default typeface's files come from. */
export const DOCUMENT_FONT_PACKAGE = "@fontsource-variable/inter";

/** CSS family stack applied to the sheet by default. */
export const DOCUMENT_FONT_FAMILY = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

/** The default family name on its own, for an engine that takes one name. */
export const DOCUMENT_FONT_NAME = "Inter Variable";

/** The serif family a document may brand itself with. */
export const SERIF_FONT_NAME = "Source Serif 4 Variable";

/** The family that carries the Arabic script, for a document written in it. */
export const ARABIC_FONT_NAME = "Noto Sans Arabic Variable";

/**
 * The weights the components ask for, so the preview can wait for the faces
 * rather than for the font set as a whole.
 *
 * `document.fonts.ready` answers about the faces layout has already requested,
 * and on a cold page it resolves before any face has been asked for, which
 * makes a plan measured behind it a plan of fallback glyphs. `document.fonts.load`
 * asks for a specific face and resolves when that face is usable, so the gate
 * names the weights the tree actually uses: the default 400, `font-medium`'s
 * 500 and `font-semibold`'s 600.
 *
 * **These are this package's own weights, not the faces'.** Every registered
 * family is variable and its one file serves the whole range it declares, so a
 * request at 400 and a request at 600 resolve to the same file and the second
 * costs nothing. The list is here because the browser matches a *request*
 * against the faces it has, and a weight the components use that nothing asks
 * for is a weight the plan is measured without. A weight added to a component
 * belongs here; adding one that no component uses is harmless.
 */
export const DOCUMENT_FONT_WEIGHTS: readonly number[] = [400, 500, 600];

/**
 * The scripts a registration may declare, each with the two things this package
 * needs to act on it.
 *
 * One table rather than two, because the pair has to stay together: `sample` is
 * a codepoint the font-loading gate asks for, and `pattern` is how a document's
 * own text is recognised as being in that script. A script named in a
 * registration's `scripts` and missing here would be a script the gate cannot
 * request a face for.
 *
 * The patterns are Unicode property escapes rather than ranges, so the mapping
 * from codepoint to script is the runtime's own and cannot drift from it.
 */
export const DOCUMENT_SCRIPTS: Record<string, { sample: string; pattern: RegExp }> = {
  // U+0041 LATIN CAPITAL LETTER A.
  Latn: { sample: "A", pattern: /\p{Script=Latin}/u },
  // U+0410 CYRILLIC CAPITAL LETTER A.
  Cyrl: { sample: "А", pattern: /\p{Script=Cyrillic}/u },
  // U+0391 GREEK CAPITAL LETTER ALPHA.
  Grek: { sample: "Α", pattern: /\p{Script=Greek}/u },
  // U+0627 ARABIC LETTER ALEF.
  Arab: { sample: "ا", pattern: /\p{Script=Arabic}/u },
};

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
    scripts: ["Latn", "Cyrl", "Grek"],
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
    scripts: ["Latn", "Cyrl", "Grek"],
  },
  {
    name: ARABIC_FONT_NAME,
    stack: '"Noto Sans Arabic Variable", ui-sans-serif, system-ui, sans-serif',
    package: "@fontsource-variable/noto-sans-arabic",
    // Every subset the package's own stylesheet loads, not only the Arabic one.
    // The set has to match what `styles.css` gives the browser: a face the
    // preview has and the PDF lacks renders as null glyphs on paper with no
    // error at all, and this family's Latin faces are what set the digits and
    // the currency codes an Arabic business letter still carries.
    subsets: ["arabic", "math", "symbols", "latin-ext", "latin"],
    file: (subset) =>
      `@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-${subset}-wght-normal.woff2`,
    weight: "100 900",
    fallback: "sans-serif",
    scripts: ["Arab", "Latn"],
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

/**
 * The text a family's faces are requested for: one letter per script it carries.
 *
 * `document.fonts.load(font)` defaults its text to a single space, and a space
 * is covered by the Latin subset of every family here. A fontsource family is
 * split into one face per subset, each with its own `unicode-range`, so a
 * request the browser can satisfy from the Latin face alone never asks for the
 * Arabic one — which is exactly the face an Arabic document is measured
 * against. So the probe names a representative codepoint from every script the
 * registration declares, and the browser loads every face those codepoints
 * fall in.
 *
 * The leading space is kept because it is what the default asked for, so a
 * family whose only script is Latin requests exactly what it used to.
 */
export function scriptProbeText(family: string): string {
  const registration = documentFontFamily(family);
  const samples = registration.scripts
    .map((script) => DOCUMENT_SCRIPTS[script]?.sample ?? "")
    .join("");
  return ` ${samples}`;
}

/**
 * Every face the stylesheet registered for one family, whatever its status.
 *
 * A `FontFaceSet` holds the faces the document's `@font-face` rules declared,
 * and asking each of them for itself is the only request that names a face
 * rather than a text: `load(shorthand, text)` resolves once the faces covering
 * *that text* are usable, and a fontsource family is one face per subset with
 * its own `unicode-range`, so no probe short of the family's whole coverage
 * reaches all of them. The PDF embeds every subset of the family, so a preview
 * that had loaded only some of them would be set in a different set of faces
 * than the paper it is compared against.
 *
 * The set is iterated with `forEach`, which is the one traversal a stubbed set
 * in a test environment can be expected to have; a set without it yields
 * nothing and the shorthand request above is the whole wait, as it was before.
 */
function registeredFaces(fonts: FontFaceSet, family: string): FontFace[] {
  if (typeof fonts.forEach !== "function") return [];
  const quoted = `"${family}"`;
  const faces: FontFace[] = [];
  fonts.forEach((face) => {
    // A face declares its family with or without quotes depending on how the
    // rule was written, so both spellings are the same family.
    if (face.family === family || face.family === quoted) faces.push(face);
  });
  return faces;
}

/**
 * Waits for the faces one family's document is set in, not for the font set.
 *
 * `document.fonts.ready` is a promise about the faces the page has *already*
 * asked for. On a cold page nothing has asked yet, so it is resolved before the
 * first layout requests a glyph, and anything measured behind it is measured
 * against whatever the browser falls back to. That is a race the preview loses
 * quietly: the plan is a plan of a document nobody will see, and on a fast
 * machine the faces win it often enough to look correct.
 *
 * So the wait names the faces, in the two ways a face can be named.
 *
 * `document.fonts.load` takes a font shorthand and a *text*, and resolves when
 * the faces covering that text are usable. The text is `scriptProbeText`'s, one
 * letter per script the family declares, because the default text is a single
 * space and a space is covered by the Latin face of every family here — a
 * default-text request would leave the Arabic face, the one an Arabic document
 * is measured against, unloaded.
 *
 * **`check` is not consulted.** It answers "can this text be rendered", and a
 * family with no face at all in the set answers yes, because the browser can
 * always fall back: a stylesheet that has not been parsed yet is indistinguishable
 * from a family already loaded. Skipping the request on that answer is exactly
 * how this gate could open onto the fallback. A request for a face already
 * loaded resolves without a fetch, so asking every time costs nothing.
 *
 * Then every face the set holds for the family is asked for itself, because the
 * probe's text cannot reach a face whose `unicode-range` covers none of it.
 * `ready` is awaited last, because a face the tree asks for that neither request
 * named is still one the layout waits on.
 *
 * An environment with no `load` — jsdom, or an old engine — falls through to
 * `ready` alone, which is what this gate was before.
 *
 * @param fonts the document's font set.
 * @param family the resolved family the document is set in.
 */
export async function loadDocumentFaces(fonts: FontFaceSet, family: string): Promise<void> {
  const shorthand = (weight: number) => `${weight} 16px "${family}"`;
  const probe = scriptProbeText(family);
  // A face that cannot be fetched is reported where it can be acted on: the
  // Chromium adapter fails naming the family, and the preview shows the
  // fallback. Leaving the gate closed forever would say nothing at all, so a
  // rejected request falls through to `ready` instead.
  const settle = (request: Promise<unknown>) =>
    request.then(
      () => undefined,
      () => undefined
    );

  // Both requests at once. They ask for the same family by two different
  // handles, and neither is a reason to hold the other up.
  const byName =
    typeof fonts.load === "function"
      ? DOCUMENT_FONT_WEIGHTS.map((weight) => settle(fonts.load(shorthand(weight), probe)))
      : [];
  const byFace = registeredFaces(fonts, family)
    .filter((face) => face.status !== "loaded")
    .map((face) => settle(face.load()));

  await Promise.all([...byName, ...byFace]);
  await fonts.ready;
}
