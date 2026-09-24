/**
 * The print time, taken out of a Chromium PDF.
 *
 * Skia writes `/CreationDate` and `/ModDate` into the document information
 * dictionary, to the second. They are the only part of the file that depends
 * on when it was printed, so two renders of one document a second apart differ
 * in those bytes and in nothing else. takumi writes no dates at all, and a
 * render that is a function of its input is what both adapters promise.
 *
 * The entries are blanked, not rewritten: each is overwritten with as many
 * spaces as it had bytes. Whitespace between dictionary entries is legal PDF,
 * and no byte moves, so every offset in the cross-reference table stays true
 * without rewriting the file. A fixed date would be a claim about when the
 * document was made that nobody made.
 */

/** A PDF date entry in a dictionary: the key and its literal string value. */
const DATE_ENTRY = /\/(?:CreationDate|ModDate)\s*\([^()\\]*\)/gu;

/**
 * `bytes` with the information dictionary's date entries blanked.
 *
 * Only the dictionary the trailer names as `/Info` is touched; a file with no
 * such dictionary is returned unchanged.
 */
export function withoutPrintDates(bytes: Uint8Array): Uint8Array {
  // latin1 maps every byte to one code unit and back, so string offsets are
  // byte offsets and the round trip is lossless for binary streams.
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");

  const trailer = text.lastIndexOf("trailer");
  if (trailer === -1) return bytes;
  const info = /\/Info\s+(\d+)\s+(\d+)\s+R/u.exec(text.slice(trailer));
  if (info === null) return bytes;

  const header = new RegExp(`(?:^|[\\r\\n])${info[1]}\\s+${info[2]}\\s+obj\\b`, "u").exec(text);
  if (header === null) return bytes;
  const start = header.index + header[0].length;
  const end = text.indexOf("endobj", start);
  if (end === -1) return bytes;

  const dictionary = text.slice(start, end);
  const blanked = dictionary.replaceAll(DATE_ENTRY, (entry) => " ".repeat(entry.length));
  if (blanked === dictionary) return bytes;

  const out = new Uint8Array(bytes);
  out.set(Buffer.from(blanked, "latin1"), start);
  return out;
}
