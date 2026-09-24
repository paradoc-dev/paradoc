/**
 * resolvers-004: memory resolver must reject bad options with a coded error.
 * Input: createMemoryResolver(undefined); createMemoryResolver({ contents: { a: new ArrayBuffer(2) } }).
 * Expected: a coded error (like the fs resolver's ERR_RESOLVER_INVALID_PATH), or for the
 * ArrayBuffer value at least a Uint8Array read result.
 * Actual (screened commit): raw TypeError with no code; the ArrayBuffer value is stored and
 * read() returns an ArrayBuffer, not a Uint8Array.
 */
import { describe, expect, test } from 'vitest'
import { createMemoryResolver } from '../../src/memory/index'

describe('resolvers-004', () => {
  test('missing options throw a coded error', () => {
    let caught: unknown
    try {
      createMemoryResolver(undefined as never)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).toHaveProperty('code', expect.stringMatching(/^ERR_RESOLVER_/))
  })

  test('non-string, non-Uint8Array content is rejected or normalized', async () => {
    let caught: unknown
    let result: unknown
    try {
      const resolver = createMemoryResolver({ contents: { a: new ArrayBuffer(2) as never } })
      result = await resolver.read('a')
    } catch (error) {
      caught = error
    }
    if (caught) {
      expect(caught).toHaveProperty('code', expect.stringMatching(/^ERR_RESOLVER_/))
    } else {
      expect(result).toBeInstanceOf(Uint8Array)
    }
  })
})
