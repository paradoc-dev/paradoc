/**
 * Tests for code snippets in concepts/logic.mdx
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/sdk'

/** Find an item's runtime state in a draft's fill state, across all buckets. */
function fieldState(draft: { getFillState: () => ReturnType<DraftFillState> }, key: string) {
  const fs = draft.getFillState()
  return [...fs.openRequired, ...fs.openOptional, ...fs.blocked, ...fs.done].find((i) => i.key === key)
}
type DraftFillState = () => {
  openRequired: { key: string; visible: boolean; status: string }[]
  openOptional: { key: string; visible: boolean; status: string }[]
  blocked: { key: string; visible: boolean; status: string }[]
  done: { key: string; visible: boolean; status: string }[]
}

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
          visible: 'fields.hasVehicle',
          required: 'fields.hasVehicle',
        },
      })
      .build()

    test('defines conditional visibility and required with fields.<id> addressing', () => {
      expect(form.kind).toBe('form')
      expect(form.fields!.vehicleMake.visible).toBe('fields.hasVehicle')
      expect(form.fields!.vehicleMake.required).toBe('fields.hasVehicle')
    })

    test('fields.<id> gate actually drives runtime visibility', () => {
      // hasVehicle true => vehicleMake visible & required
      const shown = fieldState(form.partialFill({ fields: { hasVehicle: true } }), 'vehicleMake')
      expect(shown?.visible).toBe(true)
      expect(shown?.status).toBe('required')

      // hasVehicle false => vehicleMake hidden
      const hidden = fieldState(form.partialFill({ fields: { hasVehicle: false } }), 'vehicleMake')
      expect(hidden?.visible).toBe(false)
      expect(hidden?.status).toBe('hidden')
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
        isAdult: { type: 'boolean', value: 'fields.age >= 18' },
      })
      .build()

    test('defines named logic expressions over fields.<id>', () => {
      expect(form.defs).toBeDefined()
      expect(form.defs!.isAdult).toEqual({ type: 'boolean', value: 'fields.age >= 18' })
      expect(form.fields!.drivingLicense.visible).toBe('isAdult')
      expect(form.fields!.parentConsent.visible).toBe('not isAdult')
    })

    // ============================================================================
    // Design Time vs Runtime
    // ============================================================================

    test('the same def evaluates to different visibility per data', () => {
      // age 15 => isAdult false => drivingLicense hidden, parentConsent visible
      const minor = form.partialFill({ fields: { age: 15 } })
      expect(fieldState(minor, 'drivingLicense')?.visible).toBe(false)
      expect(fieldState(minor, 'parentConsent')?.visible).toBe(true)

      // age 21 => isAdult true => drivingLicense visible, parentConsent hidden
      const adult = form.partialFill({ fields: { age: 21 } })
      expect(fieldState(adult, 'drivingLicense')?.visible).toBe(true)
      expect(fieldState(adult, 'parentConsent')?.visible).toBe(false)
    })

    test('full fill round-trips with conditional fields satisfied', () => {
      const filled1 = form.fill({ fields: { age: 15, drivingLicense: '', parentConsent: true } })
      expect(filled1.getField('age')).toBe(15)

      const filled2 = form.fill({ fields: { age: 21, drivingLicense: 'A-12345', parentConsent: false } })
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
          .visible('fields.hasPets')
          .required('fields.hasPets'),
      })
      .build()

    test('defines conditional annex visibility and required', () => {
      expect(form.annexes).toBeDefined()
      expect(form.annexes!.petPhoto).toBeDefined()
    })

    test('fields.<id> annex gate drives annex visibility', () => {
      expect(fieldState(form.partialFill({ fields: { hasPets: true } }), 'petPhoto')?.visible).toBe(true)
      expect(fieldState(form.partialFill({ fields: { hasPets: false } }), 'petPhoto')?.visible).toBe(false)
    })
  })
})
