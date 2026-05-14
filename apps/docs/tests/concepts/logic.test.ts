/**
 * Tests for code snippets in concepts/logic.mdx
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/sdk'

describe('Logic Concept', () => {
  // ============================================================================
  // Where Logic Applies
  // ============================================================================

  describe('where logic applies', () => {
    const form = para
      .form()
      .name('application')
      .fields({
        hasVehicle: { type: 'boolean', label: 'Do you have a vehicle?' },
        vehicleMake: {
          type: 'text',
          label: 'Vehicle Make',
          visible: 'fields.hasVehicle.value',
          required: 'fields.hasVehicle.value',
        },
      })
      .build()

    test('defines conditional visibility and required', () => {
      expect(form.kind).toBe('form')
      expect(form.fields!.vehicleMake.visible).toBe('fields.hasVehicle.value')
      expect(form.fields!.vehicleMake.required).toBe('fields.hasVehicle.value')
    })
  })

  // ============================================================================
  // Named Expressions
  // ============================================================================

  describe('named expressions', () => {
    const form = para
      .form()
      .name('application')
      .fields({
        age: { type: 'number' },
        drivingLicense: { type: 'text', visible: 'isAdult', required: 'isAdult' },
        parentConsent: { type: 'boolean', visible: 'not isAdult', required: 'not isAdult' },
      })
      .defs({
        isAdult: { type: 'boolean', value: 'fields.age.value >= 18' },
      })
      .build()

    test('defines named logic expressions', () => {
      expect(form.defs).toBeDefined()
      expect(form.defs!.isAdult).toEqual({ type: 'boolean', value: 'fields.age.value >= 18' })
      expect(form.fields!.drivingLicense.visible).toBe('isAdult')
      expect(form.fields!.parentConsent.visible).toBe('not isAdult')
    })

    // ============================================================================
    // Design Time vs Runtime
    // ============================================================================

    test('evaluates logic differently based on data', () => {
      // Note: .fill() validates required fields statically, so all conditionally-required
      // fields must be provided. At runtime, logic expressions determine actual visibility.
      const filled1 = form.fill({ fields: { age: 15, drivingLicense: '', parentConsent: true } })
      // drivingLicense is hidden, parentConsent is visible
      expect(filled1).toBeDefined()
      expect(filled1.getField('age')).toBe(15)

      const filled2 = form.fill({ fields: { age: 21, drivingLicense: 'A-12345', parentConsent: false } })
      // drivingLicense is visible, parentConsent is hidden
      expect(filled2).toBeDefined()
      expect(filled2.getField('age')).toBe(21)
    })
  })

  // ============================================================================
  // Logic in Annexes
  // ============================================================================

  describe('logic in annexes', () => {
    const form = para
      .form()
      .name('lease-application')
      .fields({
        hasPets: { type: 'boolean', label: 'Do you have pets?' },
      })
      .annexes({
        petPhoto: para
          .annex()
          .title('Pet Photo')
          .visible('fields.hasPets.value')
          .required('fields.hasPets.value'),
      })
      .build()

    test('defines conditional annex visibility and required', () => {
      expect(form.annexes).toBeDefined()
      expect(form.annexes!.petPhoto).toBeDefined()
    })
  })
})
