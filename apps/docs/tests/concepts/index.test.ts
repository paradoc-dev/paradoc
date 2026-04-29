/**
 * Tests for code snippets in concepts/index.mdx (Artifacts)
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/sdk'

describe('Artifacts Concept', () => {
  // ============================================================================
  // Design Time vs Runtime
  // ============================================================================

  describe('design time vs runtime', () => {
    // Design time: define the form
    const lease = para
      .form()
      .name('lease')
      .fields({
        tenant: { type: 'text', required: true },
        rent: { type: 'money', required: true },
      })
      .build()

    test('defines form at design time', () => {
      expect(lease.kind).toBe('form')
      expect(lease.name).toBe('lease')
      expect(lease.fields).toBeDefined()
      expect(Object.keys(lease.fields!)).toEqual(['tenant', 'rent'])
    })

    test('fills form at runtime', () => {
      // Runtime: fill and render
      const filled = lease.fill({
        fields: { tenant: 'Jane Doe', rent: { amount: 1500, currency: 'USD' } },
      })

      expect(filled).toBeDefined()
      expect(filled.phase).toBe('draft')
      expect(filled.getField('tenant')).toBe('Jane Doe')
    })
  })

  // ============================================================================
  // Schema-Driven
  // ============================================================================

  test('loads JSON artifact', () => {
    const json = {
      $schema: 'https://schemas.paradoc.dev/schema.json',
      kind: 'form',
      name: 'residential-lease',
      version: '1.0.0',
      fields: {
        propertyAddress: { type: 'address', required: true },
        monthlyRent: { type: 'money', required: true },
      },
    }

    const loaded = para.load(JSON.stringify(json))
    expect(loaded.kind).toBe('form')
    expect(loaded.name).toBe('residential-lease')
  })
})
