import { describe, it, expect } from 'vitest'
import { executeRender } from '../src/tools/render'

const textForm = {
  kind: 'form' as const,
  name: 'test-form',
  fields: {
    name: { type: 'text', label: 'Name', required: true },
    email: { type: 'email', label: 'Email' },
  },
  layers: {
    markdown: {
      kind: 'inline' as const,
      mimeType: 'text/markdown',
      text: '# Hello {{name}}\n\nEmail: {{email}}',
    },
  },
  defaultLayer: 'markdown',
}

describe('executeRender', () => {
  describe('inline text layer render', () => {
    it('renders form with inline text layer', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: textForm,
        data: {
          fields: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      })

      expect(result.success).toBe(true)
      expect(result.content).toBeDefined()
      expect(result.encoding).toBe('utf-8')
      expect(result.mimeType).toBe('text/markdown')
      expect(result.content).toContain('John Doe')
      expect(result.artifactKind).toBe('form')
    })
  })

  describe('default layer selection', () => {
    it('uses defaultLayer when no layer param provided', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: textForm,
        data: { fields: { name: 'Jane' } },
      })

      expect(result.success).toBe(true)
      expect(result.mimeType).toBe('text/markdown')
    })

    it('uses first layer when no defaultLayer set', async () => {
      const formNoDefault = {
        kind: 'form' as const,
        name: 'no-default',
        fields: { name: { type: 'text', label: 'Name' } },
        layers: {
          html: {
            kind: 'inline' as const,
            mimeType: 'text/html',
            text: '<p>{{name}}</p>',
          },
        },
      }

      const result = await executeRender({
        source: 'artifact' as const,
        artifact: formNoDefault,
        data: { fields: { name: 'Test' } },
      })

      expect(result.success).toBe(true)
      expect(result.mimeType).toBe('text/html')
    })
  })

  describe('missing layers error', () => {
    it('returns error when form has no layers', async () => {
      const formNoLayers = {
        kind: 'form' as const,
        name: 'no-layers',
        fields: { name: { type: 'text', label: 'Name' } },
      }

      const result = await executeRender({
        source: 'artifact' as const,
        artifact: formNoLayers,
        data: { fields: { name: 'Test' } },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('no layers')
    })
  })

  describe('file-backed layer without base URL', () => {
    it('returns error when file-backed layer has no base URL', async () => {
      const formWithFileLayer = {
        kind: 'form' as const,
        name: 'file-form',
        fields: { name: { type: 'text', label: 'Name' } },
        layers: {
          pdf: {
            kind: 'file' as const,
            mimeType: 'application/pdf',
            path: 'template.pdf',
          },
        },
      }

      const result = await executeRender({
        source: 'artifact' as const,
        artifact: formWithFileLayer,
        data: { fields: { name: 'Test' } },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('file-backed')
    })
  })

  describe('invalid artifact', () => {
    it('returns error for non-form artifact', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: {
          kind: 'document',
          name: 'test-doc',
          layers: {},
        },
        data: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles malformed artifact gracefully', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: { invalid: 'data' },
        data: {},
      })

      expect(result.success).toBe(false)
      expect(result.validationIssues || result.error).toBeDefined()
    })
  })

  describe('fill validation failure', () => {
    it('returns structured errors for missing required fields', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: textForm,
        data: { fields: {} },
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.errors![0]!.field).toContain('name')
    })
  })

  describe('artifactKind detection', () => {
    it('detects form kind', async () => {
      const result = await executeRender({
        source: 'artifact' as const,
        artifact: textForm,
        data: { fields: { name: 'Test' } },
      })

      expect(result.artifactKind).toBe('form')
    })
  })
})
