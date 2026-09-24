import { describe, expect, test } from 'vitest'
import { createMemoryResolver } from '@paradoc/resolvers/memory'

describe('createMemoryResolver', () => {
  test('matches exact keys and encodes UTF-8 text', async () => {
    const resolver = createMemoryResolver({ contents: { '/hello': 'héllo', empty: '' } })
    await expect(resolver.read('/hello')).resolves.toEqual(new TextEncoder().encode('héllo'))
    await expect(resolver.read('empty')).resolves.toEqual(new Uint8Array())
    await expect(resolver.read('hello')).rejects.toMatchObject({ code: 'ERR_RESOLVER_NOT_FOUND' })
  })

  test('owns supplied bytes and returns independent copies', async () => {
    const supplied = new Uint8Array([1, 2, 3])
    const resolver = createMemoryResolver({ contents: { binary: supplied } })
    supplied[0] = 9
    const first = await resolver.read('binary')
    first[1] = 9
    await expect(resolver.read('binary')).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  test('copies Node Buffer input and returns plain Uint8Array copies', async () => {
    const supplied = Buffer.from([1, 2, 3])
    const resolver = createMemoryResolver({ contents: { binary: supplied } })
    supplied[0] = 9
    const first = await resolver.read('binary')
    expect(Buffer.isBuffer(first)).toBe(false)
    first[1] = 9
    await expect(resolver.read('binary')).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  test.each([
    ['missing options', undefined],
    ['missing contents', {}],
    ['null contents', { contents: null }],
    ['array contents', { contents: [] }],
    ['ArrayBuffer value', { contents: { a: new ArrayBuffer(2) } }],
    ['number value', { contents: { a: 1 } }],
  ])('rejects %s with ERR_RESOLVER_INVALID_OPTIONS', (_label, options) => {
    expect(() => createMemoryResolver(options as never)).toThrow(
      expect.objectContaining({ code: 'ERR_RESOLVER_INVALID_OPTIONS' }),
    )
  })
})
