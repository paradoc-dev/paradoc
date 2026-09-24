import { describe, expect, test } from 'vitest'
import { createHttpResolver } from '@paradoc/resolvers/http'

function recordingFetch(respond: (url: string) => Response = () => new Response(new Uint8Array([1, 2, 3]))) {
  const urls: string[] = []
  const fetch = async (url: string): Promise<Response> => {
    urls.push(url)
    return respond(url)
  }
  return { urls, fetch }
}

describe('createHttpResolver', () => {
  test('reads bytes beneath the base URL for relative and one-leading-slash paths', async () => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/forms/w-9', fetch })

    await expect(resolver.read('w-9.pdf')).resolves.toEqual(new Uint8Array([1, 2, 3]))
    await resolver.read('/templates/form.pdf')

    expect(urls).toEqual([
      'https://example.com/forms/w-9/w-9.pdf',
      'https://example.com/forms/w-9/templates/form.pdf',
    ])
  })

  test('drops the base query and fragment and encodes each path segment', async () => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/?token=1#top', fetch })

    await resolver.read('a b/c?d#e%20.pdf')

    expect(urls).toEqual(['https://example.com/r/a%20b/c%3Fd%23e%2520.pdf'])
  })

  test('keeps a scheme-like path beneath the base URL', async () => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await resolver.read('https:/evil.example/x')

    expect(urls).toEqual(['https://example.com/r/https%3A/evil.example/x'])
  })

  test('accepts in-root dot segments', async () => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await resolver.read('nested/../x.pdf')

    expect(urls).toEqual(['https://example.com/r/x.pdf'])
  })

  test.each(['../x.pdf', 'nested/../../x.pdf', '/../r2/x.pdf'])('rejects %j outside the base URL without fetching', async (path) => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await expect(resolver.read(path)).rejects.toMatchObject({ code: 'ERR_RESOLVER_OUTSIDE_ROOT' })
    expect(urls).toEqual([])
  })

  test('keeps a percent-encoded dot segment as a file name', async () => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await resolver.read('%2e%2e/x.pdf')

    expect(urls).toEqual(['https://example.com/r/%252e%252e/x.pdf'])
  })

  test.each(['', '\0', '//evil.example/x', 'C:/file', 'nested\\x.pdf', '/', '.', 'a/..'])('rejects malformed path %j without fetching', async (path) => {
    const { urls, fetch } = recordingFetch()
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await expect(resolver.read(path)).rejects.toMatchObject({ code: 'ERR_RESOLVER_INVALID_PATH' })
    expect(urls).toEqual([])
  })

  test('maps a 404 to ERR_RESOLVER_NOT_FOUND and other failures to ERR_RESOLVER_FETCH_FAILED', async () => {
    const { fetch } = recordingFetch((url) => new Response(null, { status: url.endsWith('missing.pdf') ? 404 : 500 }))
    const resolver = createHttpResolver({ baseUrl: 'https://example.com/r/', fetch })

    await expect(resolver.read('missing.pdf')).rejects.toMatchObject({ code: 'ERR_RESOLVER_NOT_FOUND' })
    await expect(resolver.read('broken.pdf')).rejects.toMatchObject({ code: 'ERR_RESOLVER_FETCH_FAILED' })
  })

  test('propagates errors from the supplied fetch', async () => {
    const resolver = createHttpResolver({
      baseUrl: 'https://example.com/r/',
      fetch: async () => {
        throw new Error('Origin is not approved')
      },
    })

    await expect(resolver.read('x.pdf')).rejects.toThrow('Origin is not approved')
  })

  test.each([
    ['missing options', undefined],
    ['empty baseUrl', { baseUrl: '' }],
    ['relative baseUrl', { baseUrl: 'forms/w-9' }],
    ['non-http baseUrl', { baseUrl: 'file:///etc/' }],
    ['non-function fetch', { baseUrl: 'https://example.com/', fetch: 'nope' }],
  ])('rejects %s with ERR_RESOLVER_INVALID_OPTIONS', (_label, options) => {
    expect(() => createHttpResolver(options as never)).toThrow(
      expect.objectContaining({ code: 'ERR_RESOLVER_INVALID_OPTIONS' }),
    )
  })
})
