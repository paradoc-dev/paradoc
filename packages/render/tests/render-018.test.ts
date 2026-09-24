// render-018: encode() accepts a fractional signer index.
// Input: encode(1.5, 0). Expected: throws. Actual: returns a string starting with 'undefined'.
import { describe, expect, it } from 'vitest'
import { encode } from '../src/pdf/encoding'

describe('render-018', () => {
  it('rejects a fractional signer index', () => {
    expect(() => encode(1.5, 0)).toThrow()
  })
  it('rejects a fractional field type', () => {
    expect(() => encode(1, 0.5)).toThrow()
  })
  it('rejects a negative or out-of-range argument', () => {
    expect(() => encode(-1, 0)).toThrow()
    expect(() => encode(4096, 0)).toThrow()
    expect(() => encode(0, 16)).toThrow()
  })
  it('encodes integer arguments at the range edges', () => {
    expect(encode(0, 0)).toHaveLength(8)
    expect(encode(4095, 15)).not.toContain('undefined')
  })
})
