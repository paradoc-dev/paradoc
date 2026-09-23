import type { SealAdapter } from '@paradoc/core'

export interface HostedSealAdapterOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  /** Cancels in-flight conversion requests when aborted, for example `AbortSignal.timeout(30_000)`. */
  signal?: AbortSignal
}

interface ConvertResponse {
  document?: {
    content_base64?: string
    mime_type?: string
  }
}

const BODY_EXCERPT_LENGTH = 200

/** Thrown when the hosted conversion API fails or returns a body that is not a valid conversion result. */
export class HostedConversionError extends Error {
  override readonly name = 'HostedConversionError'
  readonly status: number
  readonly bodyExcerpt: string

  constructor(message: string, status: number, body: string) {
    const bodyExcerpt = body.slice(0, BODY_EXCERPT_LENGTH)
    super(`${message} (${status}): ${bodyExcerpt || '<empty body>'}`)
    this.status = status
    this.bodyExcerpt = bodyExcerpt
  }
}

// A multiple of 3, so each chunk encodes to whole base64 quanta with no inner padding.
const BASE64_CHUNK_BYTES = 3 * 0x2000

/** Exported for tests. Encodes without building one binary string the size of the document. */
export function encodeBase64(bytes: Uint8Array): string {
  const toBase64 = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
  if (typeof toBase64 === 'function') return toBase64.call(bytes)
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES))))
  }
  return chunks.join('')
}

function decodeBase64(value: string): Uint8Array {
  const fromBase64 = (Uint8Array as unknown as { fromBase64?: (input: string) => Uint8Array }).fromBase64
  if (typeof fromBase64 === 'function') return fromBase64(value)
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Convert non-PDF seal inputs through Paradoc's hosted conversion API. */
export function hostedSealAdapter(options: HostedSealAdapterOptions): SealAdapter {
  if (!options.apiKey) throw new Error('hostedSealAdapter requires an API key.')
  const baseUrl = (options.baseUrl ?? 'https://api.paradoc.dev').replace(/\/$/, '')
  const request = options.fetch ?? globalThis.fetch

  return {
    async convert(input) {
      const content = typeof input.document.content === 'string'
        ? new TextEncoder().encode(input.document.content)
        : input.document.content
      const response = await request(`${baseUrl}/v1/execution/convert`, {
        method: 'POST',
        headers: {
          'x-api-key': options.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_base64: encodeBase64(content),
          source_mime_type: input.document.mimeType,
          target_mime_type: 'application/pdf',
        }),
        signal: options.signal,
      })
      const text = await response.text()
      if (!response.ok) {
        throw new HostedConversionError('Paradoc conversion failed', response.status, text || response.statusText)
      }
      let result: ConvertResponse
      try {
        result = JSON.parse(text) as ConvertResponse
      } catch {
        throw new HostedConversionError('Paradoc conversion returned a response that is not JSON', response.status, text)
      }
      const document = result?.document
      if (document?.mime_type !== 'application/pdf' || !document.content_base64) {
        throw new HostedConversionError('Paradoc conversion returned an invalid PDF response', response.status, text)
      }
      return { pdf: decodeBase64(document.content_base64) }
    },
  }
}
