import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  RegistryClient,
  RegistryFetchError,
  FileSizeExceededError,
  RequestTimeoutError,
  UrlValidationError,
  ContentTypeError,
} from '../../src/utils/registry-client.js'
import { SECURITY_LIMITS, NETWORK_TIMEOUTS } from '../../src/utils/constants.js'
import type { ResolvedRegistry } from '../../src/types.js'

describe('Registry Client Error Classes', () => {
  describe('RegistryFetchError', () => {
    it('creates error with status code and url', () => {
      const error = new RegistryFetchError('Not found', 404, 'https://example.com/artifact.json')
      expect(error.name).toBe('RegistryFetchError')
      expect(error.message).toBe('Not found')
      expect(error.statusCode).toBe(404)
      expect(error.url).toBe('https://example.com/artifact.json')
    })

    it('creates error without optional fields', () => {
      const error = new RegistryFetchError('General error')
      expect(error.name).toBe('RegistryFetchError')
      expect(error.statusCode).toBeUndefined()
      expect(error.url).toBeUndefined()
    })
  })

  describe('FileSizeExceededError', () => {
    it('creates error with size details', () => {
      const error = new FileSizeExceededError(
        'File too large',
        'https://example.com/layer.pdf',
        50 * 1024 * 1024, // 50MB
        20 * 1024 * 1024 // 20MB limit
      )
      expect(error.name).toBe('FileSizeExceededError')
      expect(error.message).toBe('File too large')
      expect(error.url).toBe('https://example.com/layer.pdf')
      expect(error.size).toBe(50 * 1024 * 1024)
      expect(error.limit).toBe(20 * 1024 * 1024)
    })
  })

  describe('RequestTimeoutError', () => {
    it('creates error with url', () => {
      const error = new RequestTimeoutError('Request timed out', 'https://example.com/slow')
      expect(error.name).toBe('RequestTimeoutError')
      expect(error.message).toBe('Request timed out')
      expect(error.url).toBe('https://example.com/slow')
    })
  })

  describe('UrlValidationError', () => {
    it('creates error with url', () => {
      const error = new UrlValidationError('Blocked internal IP', 'http://127.0.0.1/secret')
      expect(error.name).toBe('UrlValidationError')
      expect(error.message).toBe('Blocked internal IP')
      expect(error.url).toBe('http://127.0.0.1/secret')
    })
  })
})

describe('Security Constants', () => {
  it('has reasonable file size limits', async () => {
    const { SECURITY_LIMITS } = await import('../../src/utils/constants.js')

    // Artifact size should be limited
    expect(SECURITY_LIMITS.MAX_ARTIFACT_SIZE).toBeLessThanOrEqual(10 * 1024 * 1024) // Max 10MB
    expect(SECURITY_LIMITS.MAX_ARTIFACT_SIZE).toBeGreaterThan(0)

    // Layer size should be limited
    expect(SECURITY_LIMITS.MAX_LAYER_SIZE).toBeLessThanOrEqual(100 * 1024 * 1024) // Max 100MB
    expect(SECURITY_LIMITS.MAX_LAYER_SIZE).toBeGreaterThan(0)

    // Index size should be limited
    expect(SECURITY_LIMITS.MAX_INDEX_SIZE).toBeLessThanOrEqual(50 * 1024 * 1024) // Max 50MB
    expect(SECURITY_LIMITS.MAX_INDEX_SIZE).toBeGreaterThan(0)
  })

  it('has reasonable network timeouts', async () => {
    const { NETWORK_TIMEOUTS } = await import('../../src/utils/constants.js')

    // Connect timeout should be reasonable (not too short, not too long)
    expect(NETWORK_TIMEOUTS.CONNECT_TIMEOUT).toBeGreaterThanOrEqual(5000) // At least 5 seconds
    expect(NETWORK_TIMEOUTS.CONNECT_TIMEOUT).toBeLessThanOrEqual(120000) // Max 2 minutes

    // Read timeout
    expect(NETWORK_TIMEOUTS.READ_TIMEOUT).toBeGreaterThanOrEqual(10000)
    expect(NETWORK_TIMEOUTS.READ_TIMEOUT).toBeLessThanOrEqual(300000)

    // Download timeout (for large files)
    expect(NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT).toBeGreaterThanOrEqual(60000)
    expect(NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT).toBeLessThanOrEqual(600000)
  })
})

describe('RegistryClient network fetches', () => {
  const registry: ResolvedRegistry = {
    namespace: '@test',
    baseUrl: 'https://registry.example.com',
    headers: { Authorization: 'Bearer t0ken' },
  }
  const indexUrl = 'https://registry.example.com/registry.json'
  const layerUrl = 'https://registry.example.com/layers/doc.md'
  const noCache = { skipCache: true, cacheTtl: 0 }

  function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })
  }

  function stubFetch(respond: (url: string, init: RequestInit) => Promise<Response> | Response) {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      respond(String(input), init ?? {})
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function hangUntilAborted(_url: string, init: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })
  }

  let cacheDir: string

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'registry-client-test-'))
  })

  afterAll(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  /** A client whose shared cache points at a scratch directory, never ~/.paradoc. */
  async function newClient(): Promise<RegistryClient> {
    const client = new RegistryClient()
    await client.initCache({ directory: cacheDir })
    return client
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('registry JSON', () => {
    it('parses the index and sends Accept plus registry headers', async () => {
      const index = { name: 'test', items: [] }
      const fetchMock = stubFetch(
        () => new Response(JSON.stringify(index), { headers: { 'content-type': 'application/json' } })
      )

      await expect((await newClient()).fetchIndex(registry, noCache)).resolves.toEqual(index)

      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe(indexUrl)
      expect(init?.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer t0ken' })
    })

    it('refuses a non-OK status', async () => {
      stubFetch(() => new Response('nope', { status: 404, statusText: 'Not Found' }))

      const error = await (await newClient()).fetchIndex(registry, noCache).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(RegistryFetchError)
      expect((error as RegistryFetchError).message).toBe(`Failed to fetch ${indexUrl}: 404 Not Found`)
      expect((error as RegistryFetchError).statusCode).toBe(404)
    })

    it('refuses a non-JSON, non-YAML content type', async () => {
      stubFetch(() => new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }))

      const error = await (await newClient()).fetchIndex(registry, noCache).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ContentTypeError)
      expect((error as ContentTypeError).message).toBe("Artifact must be JSON or YAML, got 'text/html'")
    })

    it('refuses a declared Content-Length over the index limit', async () => {
      const limit = SECURITY_LIMITS.MAX_INDEX_SIZE
      stubFetch(
        () =>
          new Response('{}', {
            headers: { 'content-type': 'application/json', 'content-length': String(limit + 1) },
          })
      )

      const error = await (await newClient()).fetchIndex(registry, noCache).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(FileSizeExceededError)
      expect((error as FileSizeExceededError).message).toBe('File size (5.0 MB) exceeds limit (5.0 MB)')
      expect((error as FileSizeExceededError).size).toBe(limit + 1)
      expect((error as FileSizeExceededError).limit).toBe(limit)
    })

    it('refuses a streamed body that grows past the index limit', async () => {
      const limit = SECURITY_LIMITS.MAX_INDEX_SIZE
      const chunk = new Uint8Array(1024 * 1024)
      stubFetch(
        () =>
          new Response(streamOf(Array.from({ length: 6 }, () => chunk)), {
            headers: { 'content-type': 'application/json' },
          })
      )

      const error = await (await newClient()).fetchIndex(registry, noCache).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(FileSizeExceededError)
      expect((error as FileSizeExceededError).message).toBe('Download size (>6.0 MB) exceeds limit (5.0 MB)')
      expect((error as FileSizeExceededError).limit).toBe(limit)
    })

    it('times out after the connect timeout', async () => {
      vi.useFakeTimers()
      stubFetch(hangUntilAborted)

      const pending = (await newClient()).fetchIndex(registry, noCache).catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUTS.CONNECT_TIMEOUT)

      const error = await pending
      expect(error).toBeInstanceOf(RequestTimeoutError)
      expect((error as RequestTimeoutError).message).toBe(
        `Request timed out after ${NETWORK_TIMEOUTS.CONNECT_TIMEOUT}ms`
      )
      expect((error as RequestTimeoutError).url).toBe(indexUrl)
    })

    it('refuses a non-https URL before fetching', async () => {
      const fetchMock = stubFetch(() => new Response('{}'))

      const error = await (await newClient())
        .fetchIndex({ ...registry, baseUrl: 'ftp://registry.example.com' }, noCache)
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(UrlValidationError)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('layer text', () => {
    it('decodes UTF-8 split across streamed chunks without adding Accept', async () => {
      const bytes = new TextEncoder().encode('Caf\u00e9 \u2713')
      const fetchMock = stubFetch(
        () =>
          new Response(streamOf([bytes.slice(0, 4), bytes.slice(4)]), {
            headers: { 'content-type': 'text/markdown' },
          })
      )

      await expect((await newClient()).fetchLayerText(registry, layerUrl)).resolves.toBe('Caf\u00e9 \u2713')
      expect(fetchMock.mock.calls[0]![1]?.headers).toEqual({ Authorization: 'Bearer t0ken' })
    })

    it('refuses a blocked content type even when allowed', async () => {
      stubFetch(() => new Response('x', { headers: { 'content-type': 'application/x-msdownload' } }))

      const error = await (await newClient())
        .fetchLayerText(registry, layerUrl, ['application/x-msdownload'])
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ContentTypeError)
      expect((error as ContentTypeError).message).toBe(
        "Content type 'application/x-msdownload' is blocked for security reasons"
      )
    })

    it('refuses a content type outside the allowed list', async () => {
      stubFetch(() => new Response('x', { headers: { 'content-type': 'text/markdown' } }))

      const error = await (await newClient())
        .fetchLayerText(registry, layerUrl, ['application/pdf'])
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ContentTypeError)
      expect((error as ContentTypeError).message).toBe("Content type 'text/markdown' is not in the allowed list")
    })

    it('refuses a declared Content-Length over the layer limit', async () => {
      const limit = SECURITY_LIMITS.MAX_LAYER_SIZE
      stubFetch(
        () =>
          new Response('x', {
            headers: { 'content-type': 'text/markdown', 'content-length': String(limit + 1) },
          })
      )

      const error = await (await newClient()).fetchLayerText(registry, layerUrl).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(FileSizeExceededError)
      expect((error as FileSizeExceededError).limit).toBe(limit)
    })

    it('times out after the download timeout, not the connect timeout', async () => {
      vi.useFakeTimers()
      stubFetch(hangUntilAborted)

      let settled = false
      const client = await newClient()
      const pending = client
        .fetchLayerText(registry, layerUrl)
        .catch((e: unknown) => e)
        .finally(() => {
          settled = true
        })
      await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUTS.CONNECT_TIMEOUT)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT - NETWORK_TIMEOUTS.CONNECT_TIMEOUT)

      const error = await pending
      expect(error).toBeInstanceOf(RequestTimeoutError)
      expect((error as RequestTimeoutError).message).toBe(
        `Request timed out after ${NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT}ms`
      )
    })
  })

  describe('layer binary', () => {
    it('returns exactly the streamed bytes', async () => {
      stubFetch(
        () =>
          new Response(streamOf([new Uint8Array([0x25, 0x50]), new Uint8Array([0x44, 0x46, 0x00])]), {
            headers: { 'content-type': 'application/pdf' },
          })
      )

      const buffer = await (await newClient()).fetchLayerBinary(registry, layerUrl)
      expect(buffer).toBeInstanceOf(ArrayBuffer)
      expect(Array.from(new Uint8Array(buffer))).toEqual([0x25, 0x50, 0x44, 0x46, 0x00])
    })

    it('refuses a streamed body that grows past the layer limit', async () => {
      const limit = SECURITY_LIMITS.MAX_LAYER_SIZE
      const chunk = new Uint8Array(limit / 2)
      stubFetch(
        () =>
          new Response(streamOf([chunk, chunk, new Uint8Array(1)]), {
            headers: { 'content-type': 'application/pdf' },
          })
      )

      const error = await (await newClient()).fetchLayerBinary(registry, layerUrl).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(FileSizeExceededError)
      expect((error as FileSizeExceededError).size).toBe(limit + 1)
      expect((error as FileSizeExceededError).limit).toBe(limit)
    })
  })
})
