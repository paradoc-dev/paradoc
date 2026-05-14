import { describe, it, expect, vi } from 'vitest'
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
      expect(result.detectedKind).toBe('form')
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

      expect(result.detectedKind).toBe('form')
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
      expect(result.detectedKind).toBe('checklist')
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
      expect(result.detectedKind).toBe('document')
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
      expect(result.detectedKind).toBe('bundle')
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
      const artifact = { kind: 'form', name: 'url-form', fields: { x: { type: 'text', label: 'X' } } }
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(artifact)))

      const result = await executeValidateArtifact(
        { source: 'url' as const, url: 'https://example.com/form.json' },
        { fetch: mockFetch },
      )

      expect(mockFetch).toHaveBeenCalled()
      expect(result.valid).toBe(true)
      expect(result.detectedKind).toBe('form')
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
      const artifact = { kind: 'form', name: 'my-form', fields: { x: { type: 'text', label: 'X' } } }

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('registry.json')) {
          return Promise.resolve(new Response(JSON.stringify(registryIndex)))
        }
        return Promise.resolve(new Response(JSON.stringify(artifact)))
      })

      const result = await executeValidateArtifact(
        { source: 'registry' as const, registryUrl: 'https://example.com', artifactName: 'my-form' },
        { fetch: mockFetch },
      )

      expect(result.valid).toBe(true)
      expect(result.detectedKind).toBe('form')
    })
  })
})
