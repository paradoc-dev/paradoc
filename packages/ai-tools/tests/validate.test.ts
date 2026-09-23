import { describe, it, expect, vi } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/core'
import { executeValidateArtifact } from '../src/tools/validate'

describe('executeValidateArtifact', () => {
  describe('form validation', () => {
    it('validates a valid form artifact', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'form',
          name: 'test-form',
          fields: {
            name: { type: 'text', label: 'Name' },
          },
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('form')
      expect(result.issues).toBeUndefined()
    })

    it('returns issues for invalid form', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'form',
          // missing required 'name' field
        },
      })

      expect(result.valid).toBe(false)
      expect(result.issues).toBeDefined()
      expect(result.issues!.length).toBeGreaterThan(0)
    })

    it('detects form kind', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'form',
          name: 'my-form',
        },
      })

      expect(result.artifact_kind).toBe('form')
    })
  })

  describe('checklist validation', () => {
    it('validates a valid checklist artifact', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'checklist',
          name: 'test-checklist',
          items: [
            { id: 'item1', title: 'First item' },
            { id: 'item2', title: 'Second item' },
          ],
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('checklist')
    })

    it('returns issues for invalid checklist', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'checklist',
        },
      })

      expect(result.valid).toBe(false)
      expect(result.issues).toBeDefined()
    })
  })

  describe('document validation', () => {
    it('validates a valid document artifact', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'document',
          name: 'test-doc',
          layers: {
            main: {
              kind: 'inline',
              mimeType: 'text/plain',
              text: 'Hello world',
            },
          },
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('document')
    })
  })

  describe('bundle validation', () => {
    it('validates a valid bundle artifact', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'bundle',
          name: 'test-bundle',
          contents: [],
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('bundle')
    })
  })

  describe('error handling', () => {
    it('handles unknown artifact kind gracefully', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {
          kind: 'unknown-kind',
          name: 'test',
        },
      })

      expect(result).toHaveProperty('valid')
    })

    it('handles empty artifact', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: {},
      })

      expect(result.valid).toBe(false)
    })
  })

  describe('URL source', () => {
    it('fetches and validates artifact from URL', async () => {
      const artifact = { $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'url-form', fields: { x: { type: 'text', label: 'X' } } }
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(artifact)))

      const result = await executeValidateArtifact(
        { source: 'url' as const, url: 'https://example.com/form.json' },
        { fetch: mockFetch },
      )

      expect(mockFetch).toHaveBeenCalled()
      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('form')
    })

    it('returns error for failed URL fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('Not found', { status: 404 }))

      const result = await executeValidateArtifact(
        { source: 'url' as const, url: 'https://example.com/missing.json' },
        { fetch: mockFetch },
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('registry source', () => {
    it('fetches and validates artifact from registry', async () => {
      const registryIndex = { items: [{ name: 'my-form' }] }
      const artifact = { $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'my-form', fields: { x: { type: 'text', label: 'X' } } }

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('registry.json')) {
          return Promise.resolve(new Response(JSON.stringify(registryIndex)))
        }
        return Promise.resolve(new Response(JSON.stringify(artifact)))
      })

      const result = await executeValidateArtifact(
        { source: 'registry' as const, registry_url: 'https://example.com', artifact_name: 'my-form' },
        { fetch: mockFetch },
      )

      expect(result.valid).toBe(true)
      expect(result.artifact_kind).toBe('form')
    })
  })

  describe('template expressions', () => {
    const form = (layers: Record<string, unknown>) => ({
      kind: 'form',
      name: 'templated',
      fields: { qty: { type: 'number', label: 'Quantity' } },
      layers,
    })

    it('reports an inline template error with its layer and position', async () => {
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        artifact: form({ md: { kind: 'inline', mimeType: 'text/markdown', text: '{{#if (gt fields.qty 1)}}x{{/if}}' } }),
      })
      expect(result.valid).toBe(false)
      expect(result.issues).toEqual([expect.objectContaining({
        message: expect.stringMatching(/^Template error at layer "md", line 1, column 7 .*> operator/),
        path: ['layers', 'md'],
      })])
    })

    it('reads file layers from the base URL and checks their templates', async () => {
      const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/terms.md')
        ? new Response('{{fields.qty}} {{fields.missing}}', { headers: { 'content-type': 'text/markdown' } })
        : new Response('missing', { status: 404 }))
      const result = await executeValidateArtifact({
        source: 'artifact' as const,
        base_url: 'https://registry.example.test/templated',
        artifact: form({ md: { kind: 'file', mimeType: 'text/markdown', path: 'terms.md' } }),
      }, { fetch })
      expect(fetch).toHaveBeenCalled()
      expect(result.valid).toBe(false)
      expect(result.issues).toEqual([expect.objectContaining({ message: expect.stringContaining('Unknown reference: fields.missing') })])
    })
  })

  describe('PDF binding fit', () => {
    /** A one-page PDF whose AcroForm holds one 48 × 12 pt text field named `source`. */
    const pdf = (): Uint8Array => {
      const bodies = [
        '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [4 0 R] >>',
        '<< /FT /Tx /T (source) /Subtype /Widget /Rect [20 20 68 32] /P 3 0 R >>',
        '<< /Fields [4 0 R] >>',
      ]
      let text = '%PDF-1.5\n'
      const offsets: number[] = []
      bodies.forEach((body, index) => {
        offsets.push(text.length)
        text += `${index + 1} 0 obj\n${body}\nendobj\n`
      })
      const xref = text.length
      text += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`
      text += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
      text += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
      return new TextEncoder().encode(text)
    }

    const validateWith = (field: Record<string, unknown>) => executeValidateArtifact({
      source: 'artifact' as const,
      base_url: 'https://registry.example.test/bound',
      artifact: {
        kind: 'form',
        name: 'bound',
        fields: { source: { label: 'Source', ...field } },
        layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', bindings: { source: 'source' } } },
      },
    }, {
      fetch: vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/form.pdf')
        ? new Response(pdf(), { headers: { 'content-type': 'application/pdf' } })
        : new Response('missing', { status: 404 })),
    })

    it('fails when a bound value cannot fit its PDF box', async () => {
      const result = await validateWith({ type: 'text', maxLength: 200 })
      expect(result.valid).toBe(false)
      expect(result.issues).toEqual([expect.objectContaining({
        message: expect.stringContaining('Layer "pdf", PDF field "source" (bound to fields.source)'),
        path: ['layers', 'pdf', 'bindings', 'source'],
      })])
    })

    it('stays valid and returns a warning for a bound text field with no length bound', async () => {
      const result = await validateWith({ type: 'text' })
      expect(result.valid).toBe(true)
      expect(result.issues).toBeUndefined()
      expect(result.warnings).toEqual([expect.objectContaining({ message: expect.stringContaining('fields.source has no maxLength or pattern') })])
    })
  })
})
