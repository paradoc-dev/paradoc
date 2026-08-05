import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test, vi } from 'vitest'
import { para } from '@paradoc/core'
import { hostedSealAdapter } from '@paradoc/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const canonicalPdf = readFileSync(path.resolve(__dirname, '../fixtures/pdfs/w9.pdf'))

describe('Sealing and Conversion Guide', () => {
  test('seals a PDF layer locally without an adapter', async () => {
    const form = para.form({
      name: 'local-pdf',
      fields: {},
      parties: { signer: { label: 'Signer', signature: { required: true } } },
      layers: {
        pdf: {
          kind: 'file',
          mimeType: 'application/pdf',
          path: 'w9.pdf',
          signatureBlocks: {
            signature: { type: 'signature', page: 1, x: 50, y: 50, width: 120, height: 30, partyRole: 'signer' },
          },
        },
      },
      defaultLayer: 'pdf',
    })

    const signable = await form
      .fill({ fields: {}, parties: { signer: { id: 'signer-1', name: 'Ada' } } })
      .addSigner('ada', { person: { name: 'Ada' } })
      .addSignatory('signer', 'signer-1', { signerId: 'ada' })
      .seal({ resolver: { read: async () => Uint8Array.from(canonicalPdf) } })

    expect(signable.canonicalPdfBytes).toBeInstanceOf(Uint8Array)
    expect(signable.canonicalPdfHash).toMatch(/^sha256:/)
  })

  test('uses the hosted adapter only to convert a rendered non-PDF layer', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, string>
      expect(request.source_mime_type).toBe('text/markdown')
      expect(atob(request.content_base64)).toBe('# Hello Ada')
      return Response.json({
        document: {
          content_base64: canonicalPdf.toString('base64'),
          mime_type: 'application/pdf',
        },
      })
    })
    const form = para.form({
      name: 'hosted-markdown',
      fields: { name: { type: 'text', required: true } },
      parties: { signer: { label: 'Signer', signature: { required: true } } },
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: '# Hello {{name}}',
          signatureBlocks: {
            signature: { type: 'signature', page: 1, x: 50, y: 50, width: 120, height: 30, partyRole: 'signer' },
          },
        },
      },
      defaultLayer: 'markdown',
    })

    const signable = await form
      .fill({ fields: { name: 'Ada' }, parties: { signer: { id: 'signer-1', name: 'Ada' } } })
      .addSigner('ada', { person: { name: 'Ada' } })
      .addSignatory('signer', 'signer-1', { signerId: 'ada' })
      .seal({
        adapter: hostedSealAdapter({ apiKey: 'test-key', baseUrl: 'https://api.example.test', fetch }),
      })

    expect(fetch).toHaveBeenCalledOnce()
    expect(signable.canonicalPdfHash).toMatch(/^sha256:/)
  })
})
