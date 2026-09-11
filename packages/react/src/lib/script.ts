/**
 * The document's script and its writing direction, and what each of them
 * demands of the thing about to render.
 *
 * A document declares a language and a direction the way HTML does, and it
 * declares them as document tokens, so one resolution reaches the preview and
 * the render alike. Two things then have to be true before anything draws it,
 * and neither of them fails loudly on its own.
 *
 * **The typeface has to carry the script.** A family with no Arabic glyphs is
 * not a fallback for an Arabic document: the browser substitutes something and
 * the engine writes a null glyph for every codepoint it cannot reach, and the
 * two are different documents with no error between them. That is the same
 * silent loss `UnregisteredFontFamilyError` exists to rule out, one level down,
 * so it is checked the same way and fails naming the script and the family.
 *
 * **The engine has to lay the direction out.** Right-to-left is not a property
 * of the text alone: it decides which edge a line starts on and which end of a
 * row the first column sits at. An engine with no `direction` puts every line
 * on the left and calls it done, which reads as a document that merely looks
 * wrong rather than as a render that failed. So an adapter declares the
 * directions it was *measured* to lay out, and a document that needs one it
 * does not declare fails naming the adapter and the script.
 *
 * The script itself is never guessed here. `Intl.Locale` maximizes a language
 * tag to the script the CLDR says it is written in, so `ar` is `Arab` and `en`
 * is `Latn` without this module carrying a table that would drift from it.
 */

const DOCUMENT_SCRIPTS: Record<string, RegExp> = {
  Latn: /\p{Script=Latin}/u,
  Cyrl: /\p{Script=Cyrillic}/u,
  Grek: /\p{Script=Greek}/u,
  Arab: /\p{Script=Arabic}/u,
};

/** Which way the document's lines run. The HTML `dir` values, and no others. */
export type TextDirection = "ltr" | "rtl";

/** The direction a document is laid out in when it declares none. */
export const DEFAULT_TEXT_DIRECTION: TextDirection = "ltr";

/** The language a document is written in when it declares none. */
export const DEFAULT_DOCUMENT_LANG = "en";

/** The script a language is written in, as an ISO 15924 code. */
export function scriptOf(lang: string): string {
  try {
    // `maximize` fills in the script the CLDR records for the language, which
    // is the one fact this module needs and the one it should not restate.
    return new Intl.Locale(lang).maximize().script ?? "Latn";
  } catch {
    // An unparsable tag is not a script this package can reason about. Latin is
    // what every registered family carries, so it is the answer that adds no
    // requirement rather than one that invents a failure.
    return "Latn";
  }
}

/** A document written in a script the family it is set in carries no glyphs for. */

/**
 * The scripts `text` is actually written in, among the ones this package knows.
 *
 * The language tag says what a document *claims* to be; this says what it
 * *contains*, which is the question a font has to answer. A document that
 * declares no language and carries Arabic is the case the tag cannot catch, and
 * it is exactly the case where the engine writes a null glyph for every letter.
 *
 * Only the scripts some registration declares are looked for. A script no
 * family here carries is one this package could not have set the document in
 * either way, so reporting it would name a failure with no remedy; that gap is
 * recorded in the README rather than turned into an error nobody can act on.
 */
export function scriptsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const [script, pattern] of Object.entries(DOCUMENT_SCRIPTS)) {
    if (pattern.test(text)) found.add(script);
  }
  return found;
}

/**
 * Every string inside a plain value, in the order it is reached.
 *
 * The document's own text is not one string anywhere: it is the artifact's
 * labels and title and the data's values, which are plain JSON-shaped objects.
 * Walking them is what makes the check a single cheap pass over what the
 * document can print rather than a second render of it.
 *
 * Cycles are not followed. An artifact and a form payload are serializable by
 * definition, so a cycle would be a different bug; the guard is here so this
 * helper cannot be the thing that hangs.
 */
export function* collectStrings(value: unknown, seen = new WeakSet<object>()): Generator<string> {
  if (typeof value === "string") {
    yield value;
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) yield* collectStrings(entry, seen);
    return;
  }
  for (const entry of Object.values(value)) yield* collectStrings(entry, seen);
}

/**
 * Fails unless the family covers every script the document's own text is in.
 *
 * The language tag is a declaration and this is the text, so the two catch
 * different mistakes. `assertScriptCovered` catches a document that says it is
 * Arabic and is set in Inter; this catches one that says nothing at all, is set
 * in Inter by default, and is Arabic anyway — which is a whole document of null
 * glyphs on paper and a browser substitution on screen, with nothing between
 * them.
 *
 * The `lang` reported on the error is the document's own, because that is what
 * a reader would have to change if the answer is that the tag was wrong rather
 * than the family.
 *
 * @throws {UnsupportedScriptError} naming the first uncovered script and the
 * family that would carry it.
 */
/**
 * Fails unless the family the document is set in carries its script.
 *
 * Called from `resolveDocumentTokens`, which is the one place both sides
 * resolve a token set, so the preview and the render make the same refusal
 * from the same declaration.
 *
 * @throws {UnregisteredFontFamilyError} when the family is not registered at all.
 * @throws {UnsupportedScriptError} when it is registered and carries no glyphs
 * for the script the language is written in.
 */
/** True when `value` is one of the two directions HTML's `dir` admits here. */
export function isTextDirection(value: unknown): value is TextDirection {
  return value === "ltr" || value === "rtl";
}
