import { describe, it, expect, vi } from 'vitest'
import { executeFill } from '../src/tools/fill'

describe('executeFill', () => {
  describe('form data fill', () => {
    const formArtifact = {
      kind: 'form' as const,
      name: 'test-form',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        email: { type: 'email', label: 'Email' },
        age: { type: 'number', label: 'Age' },
      },
    }

    it('fills valid form data', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: formArtifact,
        data: {
          fields: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifactKind).toBe('form')
      expect(result.data).toBeDefined()
      expect(result.data!.name).toBe('John Doe')
    })

    it('returns error for missing required field', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: formArtifact,
        data: {
          fields: {
            email: 'john@example.com',
          },
        },
      })

      expect(result.valid).toBe(false)
      expect(result.artifactKind).toBe('form')
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.errors![0]!.field).toContain('name')
      expect(result.errors![0]!.message).toContain('Missing required field')
    })

    it('returns error for invalid field type', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: formArtifact,
        data: {
          fields: {
            name: 'John',
            age: 'not-a-number',
          },
        },
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('applies default values', async () => {
      const formWithDefaults = {
        kind: 'form' as const,
        name: 'form-with-defaults',
        fields: {
          status: { type: 'text', label: 'Status', default: 'pending' },
        },
      }

      const result = await executeFill({
        source: 'artifact' as const,
        artifact: formWithDefaults,
        data: { fields: {} },
      })

      expect(result.valid).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.status).toBe('pending')
    })
  })

  describe('checklist data fill', () => {
    const checklistArtifact = {
      kind: 'checklist' as const,
      name: 'test-checklist',
      items: [
        { id: 'item1', title: 'First item' },
        { id: 'item2', title: 'Second item' },
        { id: 'item3', title: 'Third item' },
      ],
    }

    it('fills valid checklist data', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: checklistArtifact,
        data: {
          item1: true,
          item2: false,
          item3: true,
        },
      })

      expect(result.valid).toBe(true)
      expect(result.artifactKind).toBe('checklist')
      expect(result.data).toBeDefined()
    })

    it('fills empty checklist data', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: checklistArtifact,
        data: {},
      })

      expect(result.valid).toBe(true)
      expect(result.artifactKind).toBe('checklist')
    })
  })

  describe('unsupported artifact types', () => {
    it('returns error for document artifact', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: {
          kind: 'document',
          name: 'test-doc',
          layers: {},
        },
        data: {},
      })

      expect(result.valid).toBe(false)
      expect(result.error).toContain('form or checklist')
    })

    it('returns error for bundle artifact', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: {
          kind: 'bundle',
          name: 'test-bundle',
          contents: [],
        },
        data: {},
      })

      expect(result.valid).toBe(false)
      expect(result.error).toContain('form or checklist')
    })
  })

  describe('error handling', () => {
    it('handles malformed artifact gracefully', async () => {
      const result = await executeFill({
        source: 'artifact' as const,
        artifact: { invalid: 'artifact' },
        data: {},
      })

      expect(result.valid).toBe(false)
    })
  })

  describe('URL source', () => {
    it('fetches and fills artifact from URL', async () => {
      const artifact = {
        kind: 'form',
        name: 'url-form',
        fields: { x: { type: 'text', label: 'X' } },
      }
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(artifact)))

      const result = await executeFill(
        {
          source: 'url' as const,
          url: 'https://example.com/form.json',
          data: { fields: { x: 'hello' } },
        },
        { fetch: mockFetch },
      )

      expect(mockFetch).toHaveBeenCalled()
      expect(result.valid).toBe(true)
      expect(result.artifactKind).toBe('form')
      expect(result.data!.x).toBe('hello')
    })

    it('returns error for failed URL fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('Not found', { status: 404 }))

      const result = await executeFill(
        {
          source: 'url' as const,
          url: 'https://example.com/missing.json',
          data: { fields: {} },
        },
        { fetch: mockFetch },
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('registry source', () => {
    it('fetches and fills artifact from registry', async () => {
      const registryIndex = { items: [{ name: 'my-form' }] }
      const artifact = {
        kind: 'form',
        name: 'my-form',
        fields: { x: { type: 'text', label: 'X' } },
      }

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('registry.json')) {
          return Promise.resolve(new Response(JSON.stringify(registryIndex)))
        }
        return Promise.resolve(new Response(JSON.stringify(artifact)))
      })

      const result = await executeFill(
        {
          source: 'registry' as const,
          registryUrl: 'https://example.com',
          artifactName: 'my-form',
          data: { fields: { x: 'world' } },
        },
        { fetch: mockFetch },
      )

      expect(result.valid).toBe(true)
      expect(result.artifactKind).toBe('form')
      expect(result.data!.x).toBe('world')
    })
  })
})
