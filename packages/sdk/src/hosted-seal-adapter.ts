import type { SealAdapter } from '@paradoc/core'

export interface HostedSealAdapterOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

interface ConvertResponse {
  document: {
    content_base64: string
    mime_type: 'application/pdf'
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
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
          mime_type: input.document.mimeType,
        }),
      })
      if (!response.ok) {
        const details = await response.text()
        throw new Error(`Paradoc conversion failed (${response.status}): ${details || response.statusText}`)
      }
      const result = await response.json() as ConvertResponse
      if (result.document?.mime_type !== 'application/pdf' || !result.document.content_base64) {
        throw new Error('Paradoc conversion returned an invalid PDF response.')
      }
      return { pdf: decodeBase64(result.document.content_base64) }
    },
  }
}
