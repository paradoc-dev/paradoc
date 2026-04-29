/**
 * Tests for code snippets in guides/forms.mdx
 */
import { describe, test, expect } from 'vitest'
import { para, textRenderer } from '@paradoc/sdk'

describe('Forms Guide', () => {
  // ============================================================================
  // Step 3: Define the Form (Object Pattern)
  // ============================================================================

  describe('object pattern', () => {
    const lease = para.form({
      name: 'lease-agreement',
      version: '1.0.0',
      title: 'Residential Lease Agreement',
      parties: {
        landlord: { label: 'Landlord', signature: { required: true } },
        tenant: { label: 'Tenant', signature: { required: true } },
      },
      fields: {
        address: { type: 'address', label: 'Property Address', required: true },
        monthlyRent: { type: 'money', label: 'Monthly Rent', required: true },
        startDate: { type: 'date', label: 'Start Date', required: true },
        endDate: { type: 'date', label: 'End Date', required: true },
      },
    })

    test('creates form with correct properties', () => {
      expect(lease.kind).toBe('form')
      expect(lease.name).toBe('lease-agreement')
      expect(lease.version).toBe('1.0.0')
      expect(lease.title).toBe('Residential Lease Agreement')
      expect(Object.keys(lease.fields!)).toEqual(['address', 'monthlyRent', 'startDate', 'endDate'])
      expect(Object.keys(lease.parties!)).toEqual(['landlord', 'tenant'])
    })
  })

  // ============================================================================
  // Step 3: Define the Form (Builder Pattern)
  // ============================================================================

  describe('builder pattern', () => {
    const lease = para
      .form()
      .name('lease-agreement')
      .version('1.0.0')
      .title('Residential Lease Agreement')
      .parties({
        landlord: para.party().label('Landlord').signature({ required: true }),
        tenant: para.party().label('Tenant').signature({ required: true }),
      })
      .fields({
        address: para.field.address().label('Property Address').required(),
        monthlyRent: para.field.money().label('Monthly Rent').required(),
        startDate: para.field.date().label('Start Date').required(),
        endDate: para.field.date().label('End Date').required(),
      })
      .build()

    test('creates form with correct properties', () => {
      expect(lease.kind).toBe('form')
      expect(lease.name).toBe('lease-agreement')
      expect(lease.version).toBe('1.0.0')
      expect(Object.keys(lease.fields!)).toEqual(['address', 'monthlyRent', 'startDate', 'endDate'])
    })
  })

  // ============================================================================
  // Step 4: Add a Layer (Object Pattern with Inline Layer)
  // ============================================================================

  describe('form with inline layer', () => {
    const lease = para.form({
      name: 'lease-agreement',
      version: '1.0.0',
      title: 'Residential Lease Agreement',
      parties: {
        landlord: { label: 'Landlord', signature: { required: true } },
        tenant: { label: 'Tenant', signature: { required: true } },
      },
      fields: {
        address: { type: 'address', label: 'Property Address', required: true },
        monthlyRent: { type: 'money', label: 'Monthly Rent', required: true },
        startDate: { type: 'date', label: 'Start Date', required: true },
        endDate: { type: 'date', label: 'End Date', required: true },
      },
      defaultLayer: 'markdown',
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: `
# Residential Lease Agreement

**Property:** {{address}}
**Monthly Rent:** {{monthlyRent}}
**Term:** {{startDate}} to {{endDate}}

**Landlord:** {{parties.landlord.name}}
**Tenant:** {{parties.tenant.name}}
          `,
        },
      },
    })

    test('has inline layer', () => {
      expect(lease.defaultLayer).toBe('markdown')
      expect(lease.layers).toBeDefined()
      expect(lease.layers!.markdown).toBeDefined()
    })

    // ============================================================================
    // Step 5: Fill the Form
    // ============================================================================

    const filled = lease.fill({
      parties: {
        landlord: { id: 'landlord-1', name: 'Jane Smith' },
        tenant: { id: 'tenant-1', name: 'John Doe' },
      },
      fields: {
        address: {
          line1: '123 Main St',
          locality: 'Portland',
          region: 'OR',
          postalCode: '97201',
          country: 'USA',
        },
        monthlyRent: { amount: 1500, currency: 'USD' },
        startDate: '2025-02-01',
        endDate: '2026-01-31',
      },
    })

    test('fills the form with data', () => {
      expect(filled).toBeDefined()
      expect(filled.phase).toBe('draft')
      expect(filled.getField('startDate')).toBe('2025-02-01')
    })

    // ============================================================================
    // Step 6: Render the Form
    // ============================================================================

    test('renders the form with text renderer', async () => {
      const output = await filled.render({
        renderer: textRenderer(),
      })

      expect(output).toContain('Residential Lease Agreement')
      expect(output).toContain('123 Main St')
      expect(output).toContain('Portland')
      expect(output).toContain('$1,500.00')
      expect(output).toContain('Jane Smith')
      expect(output).toContain('John Doe')
    })

    // ============================================================================
    // Step 7: Save the Artifact
    // ============================================================================

    test('serializes to JSON', () => {
      const json = lease.toJSON()
      expect(json.kind).toBe('form')
      expect(json.name).toBe('lease-agreement')
    })

    test('serializes to YAML', () => {
      const yaml = lease.toYAML()
      expect(yaml).toContain('kind: form')
      expect(yaml).toContain('name: lease-agreement')
    })

    test('loads from JSON string', () => {
      const jsonStr = JSON.stringify(lease.toJSON())
      const loaded = para.load(jsonStr)
      expect(loaded.kind).toBe('form')
      expect(loaded.name).toBe('lease-agreement')
    })

    test('loads from YAML string', () => {
      const yaml = lease.toYAML()
      const loaded = para.load(yaml)
      expect(loaded.kind).toBe('form')
      expect(loaded.name).toBe('lease-agreement')
    })
  })
})
