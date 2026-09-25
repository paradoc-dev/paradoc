/**
 * The document's language, script, and writing direction.
 *
 * A document declares a language and a direction the way HTML does, and it
 * declares language and direction as document tokens, so one resolution
 * reaches the preview and the render alike. The selected engine must then lay
 * that direction out correctly before anything draws it.
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

/** True when `value` is one of the two directions HTML's `dir` admits here. */
export function isTextDirection(value: unknown): value is TextDirection {
  return value === "ltr" || value === "rtl";
}
