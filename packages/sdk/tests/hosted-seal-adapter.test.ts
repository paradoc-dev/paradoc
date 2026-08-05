import { describe, expect, it, vi } from 'vitest'
import { hostedSealAdapter } from '../src/hosted-seal-adapter'

describe('hostedSealAdapter', () => {
  it('sends rendered native bytes to the conversion endpoint and returns PDF bytes', async () => {
    const pdf = new TextEncoder().encode('%PDF-test')
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, string>
      expect(body.mime_type).toBe('text/markdown')
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
      'https://api.example.test/v1/execution/convert',
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
})
