/**
 * Tests for code snippets in concepts/forms.mdx (Anatomy of a Form)
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/sdk'

describe('Forms Concept', () => {
  // ============================================================================
  // Fields
  // ============================================================================

  describe('fields', () => {
    const form = para
      .form()
      .name('application')
      .fields({
        fullName: { type: 'text', label: 'Full Name', required: true },
        age: { type: 'number', label: 'Age' },
        startDate: { type: 'date', label: 'Start Date' },
      })
      .build()

    test('defines form with typed fields', () => {
      expect(form.kind).toBe('form')
      expect(form.name).toBe('application')
      expect(Object.keys(form.fields!)).toEqual(['fullName', 'age', 'startDate'])
    })
  })

  // ============================================================================
  // Primitives
  // ============================================================================

  describe('primitives', () => {
    const form = para
      .form()
      .name('primitives-example')
      .fields({
        propertyAddress: { type: 'address', label: 'Property Address' },
        monthlyRent: { type: 'money', label: 'Monthly Rent' },
        tenantPhone: { type: 'phone', label: 'Phone Number' },
      })
      .build()

    test('defines form with primitive field types', () => {
      expect(form.fields!.propertyAddress.type).toBe('address')
      expect(form.fields!.monthlyRent.type).toBe('money')
      expect(form.fields!.tenantPhone.type).toBe('phone')
    })
  })

  // ============================================================================
  // Parties
  // ============================================================================

  describe('parties', () => {
    const form = para
      .form()
      .name('lease')
      .parties({
        landlord: para.party().label('Landlord'),
        tenant: para.party().label('Tenant').multiple(true).max(4),
      })
      .build()

    test('defines form with party roles', () => {
      expect(form.parties).toBeDefined()
      expect(Object.keys(form.parties!)).toEqual(['landlord', 'tenant'])
    })
  })

  // ============================================================================
  // Signatures
  // ============================================================================

  describe('signatures', () => {
    const form = para
      .form()
      .name('purchase')
      .parties({
        buyer: para.party().label('Buyer').signature({ required: true, witnesses: 1 }),
        seller: para.party().label('Seller').signature({ required: true }),
      })
      .build()

    test('defines signature requirements per party', () => {
      expect(form.parties!.buyer.signature).toBeDefined()
      expect(form.parties!.buyer.signature!.required).toBe(true)
      expect(form.parties!.seller.signature).toBeDefined()
    })
  })

  // ============================================================================
  // Annexes
  // ============================================================================

  describe('annexes', () => {
    const form = para
      .form()
      .name('lease-application')
      .annexes({
        photoId: para.annex().title('Photo ID').required(true),
        proofOfIncome: para.annex().title('Proof of Income').required(true),
      })
      .build()

    test('defines form with annexes', () => {
      expect(form.annexes).toBeDefined()
      expect(Object.keys(form.annexes!)).toEqual(['photoId', 'proofOfIncome'])
    })
  })
})
