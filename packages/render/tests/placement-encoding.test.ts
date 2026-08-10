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

  it('strips encodings without touching surrounding text', () => {
    const text = `sign: ${encode(3, 0)}____`
    expect(stripEncoding(text)).toBe('sign: ____')
    expect(containsEncoding(text)).toBe(true)
    expect(containsEncoding('plain')).toBe(false)
  })
})
