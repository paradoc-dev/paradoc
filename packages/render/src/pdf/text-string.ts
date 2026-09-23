/**
 * PDF strings and text strings (ISO 32000-2, 7.9.2).
 *
 * The parser keeps every string object as a byte string: one JavaScript
 * character per byte, U+0000 to U+00FF. Most strings are bytes, not text
 * (`/DA` holds content-stream operators, `/ID` and signature `/Contents` are
 * binary), so they are never reinterpreted and serialize back byte for byte.
 *
 * Entries the specification types as text strings (a field's `/T`, `/TU`,
 * `/TM`, a text or choice field's `/V` and `/DV`, choice `/Opt` entries)
 * are decoded where they are read, with {@link decodeTextString}, and a
 * text value is encoded before it is stored, with {@link encodeTextString}.
 */

/**
 * PDFDocEncoding (ISO 32000-2, Annex D) where it differs from ISO-8859-1.
 * Codes it leaves undefined (0x7F, 0x9F, 0xAD, and the control codes other
 * than tab, line feed, and carriage return) decode as their Latin-1 character
 * and are never produced by the encoder.
 */
const PDF_DOC_DIFFERENCES: ReadonlyArray<readonly [number, number]> = [
  [0x18, 0x02d8], [0x19, 0x02c7], [0x1a, 0x02c6], [0x1b, 0x02d9],
  [0x1c, 0x02dd], [0x1d, 0x02db], [0x1e, 0x02da], [0x1f, 0x02dc],
  [0x80, 0x2022], [0x81, 0x2020], [0x82, 0x2021], [0x83, 0x2026],
  [0x84, 0x2014], [0x85, 0x2013], [0x86, 0x0192], [0x87, 0x2044],
  [0x88, 0x2039], [0x89, 0x203a], [0x8a, 0x2212], [0x8b, 0x2030],
  [0x8c, 0x201e], [0x8d, 0x201c], [0x8e, 0x201d], [0x8f, 0x2018],
  [0x90, 0x2019], [0x91, 0x201a], [0x92, 0x2122], [0x93, 0xfb01],
  [0x94, 0xfb02], [0x95, 0x0141], [0x96, 0x0152], [0x97, 0x0160],
  [0x98, 0x0178], [0x99, 0x017d], [0x9a, 0x0131], [0x9b, 0x0142],
  [0x9c, 0x0153], [0x9d, 0x0161], [0x9e, 0x017e], [0xa0, 0x20ac],
]

const UNDEFINED_PDF_DOC = new Set([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0b, 0x0c,
  0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x7f, 0x9f, 0xad,
])

const PDF_DOC_TO_UNICODE: readonly number[] = (() => {
  const table = Array.from({ length: 256 }, (_, code) => code)
  for (const [code, unicode] of PDF_DOC_DIFFERENCES) table[code] = unicode
  return table
})()

const UNICODE_TO_PDF_DOC: ReadonlyMap<number, number> = new Map(
  PDF_DOC_TO_UNICODE.flatMap((unicode, code) => UNDEFINED_PDF_DOC.has(code) ? [] : [[unicode, code] as const]),
)

const ESCAPE = '\u001b'

/** Drop the language and country escape sequences a Unicode text string may carry (7.9.2.2.1). */
function withoutLanguageEscapes(text: string): string {
  let result = ''
  let cursor = 0
  while (cursor < text.length) {
    const start = text.indexOf(ESCAPE, cursor)
    const end = start === -1 ? -1 : text.indexOf(ESCAPE, start + 1)
    if (end === -1) return result + text.slice(cursor)
    result += text.slice(cursor, start)
    cursor = end + 1
  }
  return result
}

/** A byte string holding each byte of `bytes` as one character, U+0000 to U+00FF. */
export function byteString(bytes: Uint8Array): string {
  let result = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return result
}

function stringBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index)
  return bytes
}

/**
 * The text a PDF text string holds: UTF-16BE after a FE FF byte order mark,
 * UTF-8 after an EF BB BF one (PDF 2.0), and PDFDocEncoding otherwise.
 *
 * @param value - A byte string, as the parser produces it.
 */
export function decodeTextString(value: string): string {
  if (value.charCodeAt(0) === 0xfe && value.charCodeAt(1) === 0xff) {
    let text = ''
    for (let index = 2; index + 1 < value.length; index += 2) {
      text += String.fromCharCode((value.charCodeAt(index) << 8) | value.charCodeAt(index + 1))
    }
    return withoutLanguageEscapes(text)
  }
  if (value.charCodeAt(0) === 0xef && value.charCodeAt(1) === 0xbb && value.charCodeAt(2) === 0xbf) {
    return withoutLanguageEscapes(new TextDecoder('utf-8').decode(stringBytes(value.slice(3))))
  }
  let text = ''
  for (let index = 0; index < value.length; index++) text += String.fromCharCode(PDF_DOC_TO_UNICODE[value.charCodeAt(index) & 0xff]!)
  return text
}

/**
 * The byte string that stores `text` as a PDF text string: PDFDocEncoding
 * when every character has a code there, UTF-16BE with a byte order mark
 * otherwise, which every PDF version reads.
 */
export function encodeTextString(text: string): string {
  let encoded = ''
  for (let index = 0; index < text.length; index++) {
    const code = UNICODE_TO_PDF_DOC.get(text.charCodeAt(index))
    if (code === undefined) return utf16(text)
    encoded += String.fromCharCode(code)
  }
  return encoded
}

function utf16(text: string): string {
  // UTF-16 code units, so a character outside the Basic Multilingual Plane
  // keeps both halves of its surrogate pair.
  let encoded = '\u00fe\u00ff'
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index)
    encoded += String.fromCharCode(unit >> 8, unit & 0xff)
  }
  return encoded
}
