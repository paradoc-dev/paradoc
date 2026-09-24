/**
 * resolvers-001: memory resolver must copy Node Buffer inputs and outputs.
 * Input: createMemoryResolver({ contents: { a: Buffer.from([1, 2, 3]) } }); mutate the
 * supplied Buffer and a returned read result.
 * Expected: a later read returns [1, 2, 3].
 * Actual (screened commit): Buffer.prototype.slice returns a view, so the read returns [9, 9, 3].
 */
import { describe, expect, test } from 'vitest'
import { createMemoryResolver } from '../../src/memory/index'

describe('resolvers-001', () => {
  test('Buffer input is copied at construction', async () => {
    const buf = Buffer.from([1, 2, 3])
    const resolver = createMemoryResolver({ contents: { a: buf } })
    buf[0] = 9
    expect(Array.from(await resolver.read('a'))).toEqual([1, 2, 3])
  })

  test('each read returns an independent copy', async () => {
    const resolver = createMemoryResolver({ contents: { a: Buffer.from([1, 2, 3]) } })
    const first = await resolver.read('a')
    first[1] = 9
    expect(Array.from(await resolver.read('a'))).toEqual([1, 2, 3])
  })
})
