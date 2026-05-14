/**
 * Tests for code snippets in concepts/composition.mdx
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/sdk'

describe('Composition Concept', () => {
  // ============================================================================
  // Reusing Fields
  // ============================================================================

  describe('reusing fields', () => {
    // common/fields.ts
    const contactFields = {
      fullName: { type: 'text' as const, label: 'Full Name', required: true as const },
      email: { type: 'text' as const, label: 'Email', required: true as const },
      phone: { type: 'phone' as const, label: 'Phone Number' },
    }

    // forms/application.ts
    const application = para
      .form()
      .name('application')
      .fields({
        ...contactFields,
        applicationDate: { type: 'date', required: true },
      })
      .build()

    test('composes fields by spreading shared definitions', () => {
      expect(application.kind).toBe('form')
      expect(Object.keys(application.fields!)).toEqual([
        'fullName',
        'email',
        'phone',
        'applicationDate',
      ])
    })
  })

  // ============================================================================
  // Bundles
  // ============================================================================

  describe('bundles', () => {
    const leaseAgreement = para.form({
      name: 'lease-agreement',
      title: 'Lease Agreement',
    })

    const leadPaintDisclosure = para.document({
      name: 'lead-paint-disclosure',
      title: 'Lead Paint Disclosure',
    })

    const applicationChecklist = para.checklist({
      name: 'application-checklist',
      title: 'Application Checklist',
      items: [{ id: 'credit-check', title: 'Credit Check' }],
    })

    const leasePackage = para
      .bundle()
      .name('lease-package')
      .title('Complete Lease Package')
      .contents([
        { type: 'inline', key: 'lease', artifact: leaseAgreement },
        { type: 'inline', key: 'disclosure', artifact: leadPaintDisclosure },
        { type: 'inline', key: 'checklist', artifact: applicationChecklist },
      ])
      .build()

    test('composes artifacts into a bundle', () => {
      expect(leasePackage.kind).toBe('bundle')
      expect(leasePackage.name).toBe('lease-package')
      expect(leasePackage.contents).toHaveLength(3)
    })
  })
})
