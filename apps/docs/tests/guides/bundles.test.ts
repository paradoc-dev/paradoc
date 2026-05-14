/**
 * Tests for code snippets in guides/bundles.mdx
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/core'
import { textRenderer } from '@paradoc/renderer-text'

describe('Bundles Guide', () => {
  // ============================================================================
  // Step 1: Define the Artifacts
  // ============================================================================

  describe('object pattern artifacts', () => {
    const lease = para.form({
      name: 'lease-agreement',
      version: '1.0.0',
      title: 'Residential Lease Agreement',
      fields: {
        address: { type: 'address', label: 'Property Address', required: true },
        monthlyRent: { type: 'money', label: 'Monthly Rent', required: true },
        startDate: { type: 'date', label: 'Start Date', required: true },
        endDate: { type: 'date', label: 'End Date', required: true },
      },
      parties: {
        landlord: { label: 'Landlord', signature: { required: true } },
        tenant: { label: 'Tenant', signature: { required: true } },
      },
      defaultLayer: 'markdown',
      layers: {
        markdown: { kind: 'inline', mimeType: 'text/markdown', text: '# Lease\n\n{{address}}' },
      },
    })

    const disclosure = para.document({
      name: 'lead-paint-disclosure',
      version: '1.0.0',
      title: 'Lead Paint Disclosure',
      code: 'EPA-747-K-12-001',
      defaultLayer: 'text',
      layers: {
        text: { kind: 'inline', mimeType: 'text/plain', text: 'Lead Paint Disclosure Notice...' },
      },
    })

    const moveInChecklist = para.checklist({
      name: 'move-in-checklist',
      version: '1.0.0',
      title: 'Move-In Checklist',
      items: [
        { id: 'keys', title: 'Keys Provided' },
        { id: 'utilities', title: 'Utilities Transferred' },
        { id: 'inspection', title: 'Walk-Through Complete' },
      ],
      defaultLayer: 'text',
      layers: {
        text: {
          kind: 'inline',
          mimeType: 'text/plain',
          text: '{{#each items}}- [{{#if value}}x{{else}} {{/if}}] {{title}}\n{{/each}}',
        },
      },
    })

    test('creates all artifacts', () => {
      expect(lease.kind).toBe('form')
      expect(disclosure.kind).toBe('document')
      expect(moveInChecklist.kind).toBe('checklist')
    })

    // ============================================================================
    // Step 2: Compose the Bundle (Object Pattern)
    // ============================================================================

    describe('compose bundle (object pattern)', () => {
      const leaseBundle = para.bundle({
        name: 'lease-transaction',
        version: '1.0.0',
        title: 'Complete Lease Package',
        contents: [
          { type: 'inline', key: 'lease', artifact: lease.toJSON({ includeSchema: false }) },
          { type: 'inline', key: 'disclosure', artifact: disclosure.toJSON({ includeSchema: false }) },
          { type: 'inline', key: 'checklist', artifact: moveInChecklist.toJSON({ includeSchema: false }) },
        ],
      })

      test('creates bundle with 3 contents', () => {
        expect(leaseBundle.kind).toBe('bundle')
        expect(leaseBundle.name).toBe('lease-transaction')
        expect(leaseBundle.contents).toHaveLength(3)
      })

      // ============================================================================
      // Step 3: Validate the Bundle
      // ============================================================================

      test('validates the bundle', () => {
        expect(leaseBundle.isValid()).toBe(true)
        expect(leaseBundle.contents.length).toBe(3)
      })
    })

    // ============================================================================
    // Step 2: Compose the Bundle (Builder Pattern)
    // ============================================================================

    describe('compose bundle (builder pattern)', () => {
      const leaseBundle = para
        .bundle()
        .name('lease-transaction')
        .version('1.0.0')
        .title('Complete Lease Package')
        .inline('lease', lease)
        .inline('disclosure', disclosure)
        .inline('checklist', moveInChecklist)
        .build()

      test('creates bundle with 3 contents', () => {
        expect(leaseBundle.kind).toBe('bundle')
        expect(leaseBundle.name).toBe('lease-transaction')
        expect(leaseBundle.contents).toHaveLength(3)
      })

      test('validates the bundle', () => {
        expect(leaseBundle.isValid()).toBe(true)
      })

      // ============================================================================
      // Step 4: Assemble and Render
      // ============================================================================

      test('assembles and renders the bundle', async () => {
        const filledLease = lease.fill({
          fields: {
            address: { line1: '123 Main St', locality: 'Portland', region: 'OR', postalCode: '97201', country: 'USA' },
            monthlyRent: { amount: 1500, currency: 'USD' },
            startDate: '2025-02-01',
            endDate: '2026-01-31',
          },
          parties: {
            landlord: { id: 'landlord-1', name: 'Jane Smith' },
            tenant: { id: 'tenant-1', name: 'John Doe' },
          },
        })

        const assembled = await leaseBundle.assemble({
          renderers: {
            'text/markdown': textRenderer(),
            'text/plain': textRenderer(),
          },
          contents: {
            lease: filledLease,
            disclosure: disclosure.prepare(),
            checklist: moveInChecklist.fill({ keys: true, utilities: true, inspection: false }),
          },
        })

        expect(assembled).toBeDefined()
        expect(assembled.outputs).toBeDefined()

        const outputKeys = Object.keys(assembled.outputs)
        expect(outputKeys).toContain('lease')
        expect(outputKeys).toContain('disclosure')
        expect(outputKeys).toContain('checklist')

        expect(assembled.outputs.lease.mimeType).toBe('text/markdown')
        expect(assembled.outputs.disclosure.mimeType).toBe('text/plain')
      })
    })
  })

  // ============================================================================
  // Step 5: Save the Artifact
  // ============================================================================

  describe('serialization', () => {
    const lease = para.form({
      name: 'lease-agreement',
      version: '1.0.0',
      title: 'Residential Lease Agreement',
      fields: {
        address: { type: 'address', label: 'Property Address', required: true },
      },
      defaultLayer: 'markdown',
      layers: {
        markdown: { kind: 'inline', mimeType: 'text/markdown', text: '# Lease\n\n{{address}}' },
      },
    })

    const leaseBundle = para
      .bundle()
      .name('lease-transaction')
      .version('1.0.0')
      .title('Complete Lease Package')
      .inline('lease', lease)
      .build()

    test('serializes to JSON', () => {
      const json = leaseBundle.toJSON()
      expect(json.kind).toBe('bundle')
      expect(json.name).toBe('lease-transaction')
    })

    test('serializes to YAML', () => {
      const yaml = leaseBundle.toYAML()
      expect(yaml).toContain('kind: bundle')
      expect(yaml).toContain('name: lease-transaction')
    })
  })

  // ============================================================================
  // Content Types
  // ============================================================================

  describe('content types', () => {
    const someForm = para.form({
      name: 'some-form',
      version: '1.0.0',
      title: 'Some Form',
    })

    test('supports inline, path, and registry content types', () => {
      const bundle = para
        .bundle()
        .name('mixed-bundle')
        .inline('embedded', someForm)
        .path('local', './forms/other.yaml')
        .registry('shared', '@acme/disclosure')
        .build()

      expect(bundle.contents).toHaveLength(3)
      expect(bundle.contents[0].type).toBe('inline')
      expect(bundle.contents[1].type).toBe('path')
      expect(bundle.contents[2].type).toBe('registry')
    })
  })
})
