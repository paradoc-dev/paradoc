/**
 * Invisible Unicode encoding for signature position detection.
 *
 * Four braille codepoints render as blank glyphs in non-braille fonts but
 * survive HTML→PDF (Chromium) and DOCX→PDF (LibreOffice) conversion with
 * intact ToUnicode maps, so they can be located again in the PDF text layer.
 *
 * Scheme: 8 characters, base-4. Chars 0-5 carry the signer index (0-4095),
 * chars 6-7 the field type (0-15).
 */

export const ALPHABET = [
  '⠀', // Braille Pattern Blank
  '⠁', // Braille Pattern Dots-1
  '⠂', // Braille Pattern Dots-2
  '⠄', // Braille Pattern Dots-3
] as const

export const FieldType = {
  SIGNATURE: 0,
  INITIALS: 1,
} as const

export type FieldTypeValue = (typeof FieldType)[keyof typeof FieldType]

export const MAX_SIGNER_INDEX = 4095
export const MAX_FIELD_TYPE = 15
export const ENCODING_LENGTH = 8

export function encode(signerIndex: number, fieldType: number): string {
  if (signerIndex < 0 || signerIndex > MAX_SIGNER_INDEX) {
    throw new Error(`Signer index must be 0-${MAX_SIGNER_INDEX}, got ${signerIndex}`)
  }
  if (fieldType < 0 || fieldType > MAX_FIELD_TYPE) {
    throw new Error(`Field type must be 0-${MAX_FIELD_TYPE}, got ${fieldType}`)
  }
  let result = ''
  let remaining = signerIndex
  for (let index = 0; index < 6; index++) {
    result = ALPHABET[remaining % 4] + result
    remaining = Math.floor(remaining / 4)
  }
  result += ALPHABET[Math.floor(fieldType / 4)]
  result += ALPHABET[fieldType % 4]
  return result
}

export interface DecodedEncoding {
  signerIndex: number
  fieldType: number
}

export interface DecodedEncodingWithPosition extends DecodedEncoding {
  /** Character position in the scanned text where the encoding starts. */
  position: number
}

/** Decode the first complete encoding found in `text`, or null. */
export function decode(text: string): DecodedEncoding | null {
  const first = decodeAll(text)[0]
  return first ? { signerIndex: first.signerIndex, fieldType: first.fieldType } : null
}

export function decodeAll(text: string): DecodedEncodingWithPosition[] {
  const results: DecodedEncodingWithPosition[] = []
  let found: number[] = []
  let start = -1

  for (let index = 0; index < text.length; index++) {
    const digit = ALPHABET.indexOf(text[index] as (typeof ALPHABET)[number])
    if (digit === -1) continue
    if (found.length === 0) start = index
    found.push(digit)
    if (found.length < ENCODING_LENGTH) continue

    let signerIndex = 0
    for (let place = 0; place < 6; place++) signerIndex = signerIndex * 4 + found[place]!
    results.push({ signerIndex, fieldType: found[6]! * 4 + found[7]!, position: start })
    found = []
    start = -1
  }

  return results
}

export function stripEncoding(text: string): string {
  const pattern = new RegExp(`[${ALPHABET.join('')}]`, 'g')
  return text.replace(pattern, '')
}

export function containsEncoding(text: string): boolean {
  return ALPHABET.some((character) => text.includes(character))
}

export function fieldTypeToString(fieldType: number): 'signature' | 'initials' | 'unknown' {
  if (fieldType === FieldType.SIGNATURE) return 'signature'
  if (fieldType === FieldType.INITIALS) return 'initials'
  return 'unknown'
}
