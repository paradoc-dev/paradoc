import { describe, expect, it } from 'vitest'
import { ALPHABET, FieldType, containsEncoding, decodeAll, encode, stripEncoding } from '../src/pdf/encoding'

describe('encoding', () => {
  it('round-trips every field type across the signer range', () => {
    // The braille scheme is the wire format shared with converters: a change
    // here silently breaks extraction of documents rendered by older code.
    for (const signerIndex of [0, 1, 5, 63, 4095]) {
      for (const fieldType of [FieldType.SIGNATURE, FieldType.INITIALS]) {
        const text = `before ${encode(signerIndex, fieldType)}________ after`
        const decoded = decodeAll(text)
        expect(decoded).toHaveLength(1)
        expect(decoded[0]).toMatchObject({ signerIndex, fieldType })
      }
    }
  })

  it('produces exactly 8 alphabet characters', () => {
    const encoded = encode(42, FieldType.INITIALS)
    expect(encoded).toHaveLength(8)
    for (const character of encoded) {
      expect(ALPHABET).toContain(character)
    }
  })

  it('rejects out-of-range input', () => {
    expect(() => encode(4096, 0)).toThrow()
    expect(() => encode(-1, 0)).toThrow()
    expect(() => encode(0, 16)).toThrow()
  })

  it('finds multiple encodings with their positions', () => {
    const text = `${encode(0, 0)}____ middle ${encode(7, 1)}____`
    const decoded = decodeAll(text)
    expect(decoded).toHaveLength(2)
    expect(decoded[0]!.position).toBe(0)
    expect(decoded[1]!.signerIndex).toBe(7)
    expect(decoded[1]!.fieldType).toBe(1)
  })

  it('decodes a clean run of consecutive marker glyphs', () => {
    const text = `prose ${ALPHABET[0].repeat(7)}${ALPHABET[1]} prose`
    expect(decodeAll(text)).toEqual([{ signerIndex: 0, fieldType: 1, position: 6 }])
  })

  it('ignores a partial run split by ordinary text', () => {
    const text = `${ALPHABET[0].repeat(7)} unrelated prose between stray glyphs ${ALPHABET[1]}`
    expect(decodeAll(text)).toEqual([])
  })

  it('ignores stray glyphs scattered through prose', () => {
    const text = Array.from({ length: 8 }, (_, index) => `word ${ALPHABET[index % 4]}`).join(' ')
    expect(decodeAll(text)).toEqual([])
  })

  it('decodes a whole marker that follows an abandoned partial run', () => {
    const text = `${ALPHABET[2].repeat(5)} gap ${encode(9, FieldType.INITIALS)}____`
    const decoded = decodeAll(text)
    expect(decoded).toHaveLength(1)
    expect(decoded[0]).toMatchObject({ signerIndex: 9, fieldType: FieldType.INITIALS, position: 10 })
  })

  it('strips encodings without touching surrounding text', () => {
    const text = `sign: ${encode(3, 0)}____`
    expect(stripEncoding(text)).toBe('sign: ____')
    expect(containsEncoding(text)).toBe(true)
    expect(containsEncoding('plain')).toBe(false)
  })
})
