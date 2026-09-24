import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeBase64, encodeBase64, HOSTED_CONVERT_PATH, HostedConversionError, hostedSealAdapter } from '../src/hosted-seal-adapter'

const request = {
  form: {} as never,
  fields: {}, parties: {}, signers: {}, signatories: {}, targetLayer: 'html' as const,
  document: { content: '<p>Hello</p>', mimeType: 'text/html' },
}

function bytesOfLength(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + 7) % 256)
}

/** Hides the native Uint8Array.prototype.toBase64 so the chunked fallback runs. */
function withoutNativeBase64(bytes: Uint8Array): Uint8Array {
  Object.defineProperty(bytes, 'toBase64', { value: undefined })
  return bytes
}

describe('hostedSealAdapter', () => {
  it('sends rendered native bytes to the conversion endpoint and returns PDF bytes', async () => {
    const pdf = new TextEncoder().encode('%PDF-test')
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, string>
      expect(body.source_mime_type).toBe('text/markdown')
      expect(body.target_mime_type).toBe('application/pdf')
      expect(atob(body.content_base64)).toBe('# Hello Ada')
      expect(init?.headers).toMatchObject({ 'x-api-key': 'test-key' })
      return Response.json({
        document: {
          content_base64: btoa(String.fromCharCode(...pdf)),
          mime_type: 'application/pdf',
        },
      })
    })
    const adapter = hostedSealAdapter({ apiKey: 'test-key', baseUrl: 'https://api.example.test/', fetch })

    const result = await adapter.convert({
      form: {} as never,
      fields: {},
      parties: {},
      signers: {},
      signatories: {},
      targetLayer: 'markdown',
      document: { content: '# Hello Ada', mimeType: 'text/markdown' },
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/v1/exec/convert',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.pdf).toEqual(pdf)
  })

  it('surfaces hosted conversion errors', async () => {
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async () => new Response('unsupported MIME type', { status: 422 }),
    })

    await expect(adapter.convert({
      form: {} as never,
      fields: {}, parties: {}, signers: {}, signatories: {}, targetLayer: 'html',
      document: { content: '<p>Hello</p>', mimeType: 'text/html' },
    })).rejects.toThrow('Paradoc conversion failed (422): unsupported MIME type')
  })

  it('names the status and body excerpt when a failed response is long', async () => {
    const body = 'x'.repeat(500)
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async () => new Response(body, { status: 502 }),
    })

    const error = await adapter.convert(request).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HostedConversionError)
    expect(error).toMatchObject({ name: 'HostedConversionError', status: 502, bodyExcerpt: 'x'.repeat(200) })
  })

  it.each([
    ['an HTML page', '<html><body>Bad gateway</body></html>'],
    ['plain text', 'Internal Server Error'],
    ['an empty body', ''],
  ])('throws a HostedConversionError when a 200 response is %s', async (_label, body) => {
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async () => new Response(body, { status: 200 }),
    })

    const error = await adapter.convert(request).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HostedConversionError)
    expect(error).not.toBeInstanceOf(SyntaxError)
    expect((error as HostedConversionError).message)
      .toBe(`Paradoc conversion returned a response that is not JSON (200): ${body || '<empty body>'}`)
    expect(error).toMatchObject({ status: 200, bodyExcerpt: body })
  })

  it('throws a HostedConversionError when a JSON response has no PDF document', async () => {
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async () => Response.json({ document: { mime_type: 'text/html', content_base64: 'eA==' } }),
    })

    await expect(adapter.convert(request)).rejects.toThrow(
      /^Paradoc conversion returned an invalid PDF response \(200\): \{"document"/,
    )
  })

  it('calls the served conversion route on the default host', async () => {
    const fetch = vi.fn(async () => Response.json({
      document: { content_base64: btoa('%PDF'), mime_type: 'application/pdf' },
    }))

    await hostedSealAdapter({ apiKey: 'test-key', fetch }).convert(request)

    expect(HOSTED_CONVERT_PATH).toBe('/v1/exec/convert')
    expect(fetch).toHaveBeenCalledWith('https://api.paradoc.dev/v1/exec/convert', expect.anything())
  })

  it.each([undefined, ''])('refuses a missing API key (%j) before any request', (apiKey) => {
    const fetch = vi.fn()

    expect(() => hostedSealAdapter({ apiKey: apiKey as never, fetch })).toThrow('hostedSealAdapter requires an API key.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses timeoutMs %s', (timeoutMs) => {
    expect(() => hostedSealAdapter({ apiKey: 'test-key', timeoutMs })).toThrow(RangeError)
  })

  it('gives each request its own timeout, started when the request starts', async () => {
    const signals: AbortSignal[] = []
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal?.aborted) throw init.signal.reason
      signals.push(init!.signal!)
      return Response.json({ document: { content_base64: btoa('%PDF'), mime_type: 'application/pdf' } })
    })
    const adapter = hostedSealAdapter({ apiKey: 'test-key', fetch, timeoutMs: 30 })

    await adapter.convert(request)
    await new Promise((resolve) => setTimeout(resolve, 60))
    await adapter.convert(request)

    expect(signals).toHaveLength(2)
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
  })

  it('rejects a hung conversion when its timeout elapses', async () => {
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      timeoutMs: 10,
      fetch: (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
    })

    await expect(adapter.convert(request)).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('sends no signal when no timeout is configured', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeUndefined()
      return Response.json({ document: { content_base64: btoa('%PDF'), mime_type: 'application/pdf' } })
    })

    await hostedSealAdapter({ apiKey: 'test-key', fetch }).convert(request)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('throws a HostedConversionError when the PDF is not valid base64', async () => {
    const body = { document: { mime_type: 'application/pdf', content_base64: 'not base64!' } }
    const adapter = hostedSealAdapter({ apiKey: 'test-key', fetch: async () => Response.json(body) })

    const error = await adapter.convert(request).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HostedConversionError)
    expect((error as HostedConversionError).message)
      .toMatch(/^Paradoc conversion returned a PDF that is not valid base64 \(200\)/)
  })
})

describe('decodeBase64', () => {
  const native = (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64

  /** Hides the native Uint8Array.fromBase64 so the atob fallback runs. */
  function withoutNativeFromBase64() {
    Object.defineProperty(Uint8Array, 'fromBase64', { value: undefined, configurable: true, writable: true })
  }

  afterEach(() => {
    Object.defineProperty(Uint8Array, 'fromBase64', { value: native, configurable: true, writable: true })
  })

  it('round-trips a multi-chunk PDF through the atob fallback', () => {
    const pdf = bytesOfLength(3 * 3 * 0x2000 + 2)
    withoutNativeFromBase64()

    expect(decodeBase64(Buffer.from(pdf).toString('base64'))).toEqual(pdf)
  })

  it('throws on invalid base64 in the atob fallback', () => {
    withoutNativeFromBase64()

    expect(() => decodeBase64('not base64!')).toThrow()
  })

  it('wraps an invalid PDF from the atob fallback in HostedConversionError', async () => {
    withoutNativeFromBase64()
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async () => Response.json({ document: { mime_type: 'application/pdf', content_base64: 'not base64!' } }),
    })

    await expect(adapter.convert(request)).rejects.toBeInstanceOf(HostedConversionError)
  })
})

describe('encodeBase64', () => {
  const chunk = 3 * 0x2000

  it('uses the chunk size of a whole number of base64 quanta', () => {
    expect(chunk % 3).toBe(0)
  })

  it.each([0, 1, 2, 3, chunk - 1, chunk, chunk + 1, chunk + 2, 2 * chunk - 1, 2 * chunk, 2 * chunk + 1, 0x8000, 0x8000 + 1, 100_003])(
    'round-trips %i bytes through the chunked fallback',
    (length) => {
      const bytes = bytesOfLength(length)
      const encoded = encodeBase64(withoutNativeBase64(bytesOfLength(length)))

      expect(encoded).toBe(Buffer.from(bytes).toString('base64'))
      expect(encoded.slice(0, -2)).not.toContain('=')
      expect(new Uint8Array(Buffer.from(encoded, 'base64'))).toEqual(bytes)
    },
  )

  it('uses the native toBase64 when the runtime has it', () => {
    const bytes = bytesOfLength(10)
    const toBase64 = vi.fn(() => 'native')
    Object.defineProperty(bytes, 'toBase64', { value: toBase64 })

    expect(encodeBase64(bytes)).toBe('native')
    expect(toBase64).toHaveBeenCalledOnce()
  })

  it('sends a multi-chunk document intact and decodes a multi-chunk PDF', async () => {
    const source = withoutNativeBase64(bytesOfLength(2 * chunk + 1))
    const pdf = bytesOfLength(3 * chunk + 2)
    const adapter = hostedSealAdapter({
      apiKey: 'test-key',
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { content_base64: string }
        expect(new Uint8Array(Buffer.from(body.content_base64, 'base64'))).toEqual(bytesOfLength(2 * chunk + 1))
        return Response.json({ document: { content_base64: Buffer.from(pdf).toString('base64'), mime_type: 'application/pdf' } })
      },
    })

    const result = await adapter.convert({ ...request, document: { content: source, mimeType: 'application/octet-stream' } })
    expect(result.pdf).toEqual(pdf)
  })
})
