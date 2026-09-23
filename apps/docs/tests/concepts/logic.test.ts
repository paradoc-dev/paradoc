/**
 * Tests for code snippets in concepts/logic.mdx
 */
import { describe, test, expect } from 'vitest'
import { p, validate } from '@paradoc/sdk'

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
    const form = p
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
      const shown = fieldState(form.fill({ fields: { hasVehicle: true } }), 'vehicleMake')
      expect(shown?.visible).toBe(true)
      expect(shown?.status).toBe('required')

      // hasVehicle false => vehicleMake hidden
      const hidden = fieldState(form.fill({ fields: { hasVehicle: false } }), 'vehicleMake')
      expect(hidden?.visible).toBe(false)
      expect(hidden?.status).toBe('hidden')
    })
  })

  // ============================================================================
  // Named Expressions
  // ============================================================================

  describe('named expressions', () => {
    const form = p
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
      const minor = form.fill({ fields: { age: 15 } })
      expect(fieldState(minor, 'drivingLicense')?.visible).toBe(false)
      expect(fieldState(minor, 'parentConsent')?.visible).toBe(true)

      // age 21 => isAdult true => drivingLicense visible, parentConsent hidden
      const adult = form.fill({ fields: { age: 21 } })
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
  // Aggregating Lists
  // ============================================================================

  describe('aggregating lists', () => {
    const invoice = p
      .form()
      .name('invoice')
      .fields({
        currency: { type: 'text' },
        lineItems: {
          type: 'list',
          item: {
            type: 'fieldset',
            fields: {
              description: { type: 'text' },
              amount: { type: 'money' },
              taxable: { type: 'boolean' },
            },
          },
        },
      })
      .defs({
        subtotal: {
          type: 'money',
          value: { amount: 'sum(fields.lineItems.amount).amount', currency: 'fields.currency' },
        },
        taxableTotal: { type: 'number', value: 'sum(fields.lineItems.amount.amount, fields.lineItems.taxable)' },
        rowCount: { type: 'number', value: 'count(fields.lineItems)' },
        everyRowPriced: { type: 'boolean', value: 'count(fields.lineItems, fields.lineItems.amount.amount <= 0) == 0' },
      })
      .build()

    const rows = [
      { description: 'Design', amount: { amount: 1200, currency: 'USD' }, taxable: true },
      { description: 'Hosting', amount: { amount: 99.5, currency: 'USD' }, taxable: false },
    ]

    test('evaluates the documented totals', () => {
      const draft = invoice.fill({ fields: { currency: 'USD', lineItems: rows } } as never)
      expect(draft.getFillState().defsValues).toEqual({
        subtotal: { amount: 1299.5, currency: 'USD' },
        taxableTotal: 1200,
        rowCount: 2,
        everyRowPriced: true,
      })
    })

    test('flags an unpriced row and returns the empty results for no rows', () => {
      const unpriced = invoice.fill({
        fields: { currency: 'USD', lineItems: [{ ...rows[0], amount: { amount: 0, currency: 'USD' } }] },
      } as never)
      expect(unpriced.getFillState().defsValues.everyRowPriced).toBe(false)

      const empty = invoice.fill({ fields: { currency: 'USD', lineItems: [] } } as never)
      expect(empty.getFillState().defsValues).toMatchObject({ taxableTotal: 0, rowCount: 0, everyRowPriced: true })
    })

    test('rejects a list value read outside an aggregate at authoring time', () => {
      const form = p
        .form()
        .name('invoice')
        .fields({
          lineItems: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'number' } } } },
          note: { type: 'text', visible: 'fields.lineItems.amount > 0' },
        })
        .build()
      const result = validate(form.toJSON())
      const messages = 'issues' in result && result.issues ? result.issues.map((issue) => issue.message) : []
      expect(messages.join('\n')).toMatch(/reads a value from every row of fields.lineItems/)
      expect(validate(invoice.toJSON())).not.toHaveProperty('issues')
    })
  })

  // ============================================================================
  // Logic in Annexes
  // ============================================================================

  describe('logic in annexes', () => {
    const form = p
      .form()
      .name('lease-application')
      .fields({
        hasPets: { type: 'boolean', label: 'Do you have pets?' },
      })
      .annexes({
        petPhoto: p
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
      expect(fieldState(form.fill({ fields: { hasPets: true } }), 'petPhoto')?.visible).toBe(true)
      expect(fieldState(form.fill({ fields: { hasPets: false } }), 'petPhoto')?.visible).toBe(false)
    })
  })
})
