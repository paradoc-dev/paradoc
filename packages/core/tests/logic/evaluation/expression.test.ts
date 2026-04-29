import { describe, test, expect } from 'vitest'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import { buildFormContext } from '@/logic/runtime/evaluation/context-builder'
import type { Form, DefsSection } from '@paradoc/types'
import { getDefsValues } from '../helpers/evaluation-helpers'

/**
 * Tests for Expression evaluation with typed computed values.
 *
 * These tests verify:
 * - Scalar expressions (boolean, string, number, etc.)
 * - Object expressions (money, address, phone, etc.)
 * - Metadata (label, description) on expressions
 * - Cross-references between logic keys
 */
describe('Expression evaluation', () => {
  // ============================================================================
  // Scalar Expression Tests
  // ============================================================================

  describe('scalar expressions', () => {
    test('evaluates boolean expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          age: { type: 'number' },
        },
        defs: {
          isAdult: {
            type: 'boolean',
            label: 'Adult Status',
            description: 'Whether the person is 18 or older',
            value: 'fields.age >= 18',
          },
        },
      }

      const result = evaluateFormDefs(form, { fields: { age: 25 } })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('isAdult')).toBe(true)
      }
    })

    test('evaluates string expression with concat', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          firstName: { type: 'text' },
          lastName: { type: 'text' },
        },
        defs: {
          name: {
            type: 'string',
            label: 'Full Name',
            value: 'fields.firstName || " " || fields.lastName',
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { firstName: 'John', lastName: 'Doe' },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('name')).toBe('John Doe')
      }
    })

    test('evaluates number expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          quantity: { type: 'number' },
          price: { type: 'number' },
        },
        defs: {
          subtotal: {
            type: 'number',
            label: 'Subtotal',
            description: 'Quantity times price',
            value: 'fields.quantity * fields.price',
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { quantity: 5, price: 10 },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('subtotal')).toBe(50)
      }
    })

    test('evaluates percentage expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          score: { type: 'number' },
          total: { type: 'number' },
        },
        defs: {
          percentage: {
            type: 'percentage',
            label: 'Score Percentage',
            value: '(fields.score / fields.total) * 100',
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { score: 85, total: 100 },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('percentage')).toBe(85)
      }
    })
  })

  // ============================================================================
  // Object Expression Tests
  // ============================================================================

  describe('object expressions', () => {
    test('evaluates money expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          quantity: { type: 'number' },
          unitPrice: { type: 'money' },
        },
        defs: {
          totalAmount: {
            type: 'money',
            label: 'Total Amount',
            description: 'Quantity times unit price',
            value: {
              amount: 'fields.quantity * fields.unitPrice.amount',
              currency: 'fields.unitPrice.currency',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: {
          quantity: 3,
          unitPrice: { amount: 25.5, currency: 'USD' },
        },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        const total = result.value.defsValues.get('totalAmount') as {
          amount: number
          currency: string
        }
        expect(total.amount).toBe(76.5)
        expect(total.currency).toBe('USD')
      }
    })

    test('evaluates coordinate expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          startLat: { type: 'number' },
          startLon: { type: 'number' },
          offset: { type: 'number' },
        },
        defs: {
          endPoint: {
            type: 'coordinate',
            label: 'End Point',
            value: {
              lat: 'fields.startLat + fields.offset',
              lon: 'fields.startLon + fields.offset',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { startLat: 40.7128, startLon: -74.006, offset: 0.5 },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        const coord = result.value.defsValues.get('endPoint') as {
          lat: number
          lon: number
        }
        expect(coord.lat).toBeCloseTo(41.2128)
        expect(coord.lon).toBeCloseTo(-73.506)
      }
    })

    test('evaluates phone expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          countryCode: { type: 'text' },
          phoneNumber: { type: 'text' },
        },
        defs: {
          fullPhone: {
            type: 'phone',
            label: 'Full Phone Number',
            value: {
              number: '"+" || fields.countryCode || fields.phoneNumber',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { countryCode: '1', phoneNumber: '5551234567' },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        const phone = result.value.defsValues.get('fullPhone') as {
          number: string
        }
        expect(phone.number).toBe('+15551234567')
      }
    })

    test('evaluates person expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          firstName: { type: 'text' },
          lastName: { type: 'text' },
          honorific: { type: 'text' },
        },
        defs: {
          formalPerson: {
            type: 'person',
            label: 'Formal Person',
            value: {
              name: 'fields.honorific || " " || fields.firstName || " " || fields.lastName',
              title: 'fields.honorific',
              firstName: 'fields.firstName',
              lastName: 'fields.lastName',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { firstName: 'John', lastName: 'Smith', honorific: 'Dr.' },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        const person = result.value.defsValues.get('formalPerson') as {
          name: string
          title: string
          firstName: string
          lastName: string
        }
        expect(person.name).toBe('Dr. John Smith')
        expect(person.title).toBe('Dr.')
        expect(person.firstName).toBe('John')
        expect(person.lastName).toBe('Smith')
      }
    })
  })

  // ============================================================================
  // Dependency and Cross-Reference Tests
  // ============================================================================

  describe('dependencies and cross-references', () => {
    test('logic keys can reference other logic keys', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          price: { type: 'number' },
          quantity: { type: 'number' },
          taxRate: { type: 'number' },
        },
        defs: {
          subtotal: {
            type: 'number',
            label: 'Subtotal',
            value: 'fields.price * fields.quantity',
          },
          tax: {
            type: 'number',
            label: 'Tax',
            value: 'subtotal * (fields.taxRate / 100)',
          },
          total: {
            type: 'number',
            label: 'Total',
            value: 'subtotal + tax',
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { price: 100, quantity: 2, taxRate: 10 },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('subtotal')).toBe(200)
        expect(result.value.defsValues.get('tax')).toBe(20)
        expect(result.value.defsValues.get('total')).toBe(220)
      }
    })

    test('object expression can reference other logic keys', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          quantity: { type: 'number' },
          unitPrice: { type: 'money' },
          discountPercent: { type: 'number' },
        },
        defs: {
          subtotal: {
            type: 'number',
            value: 'fields.quantity * fields.unitPrice.amount',
          },
          discount: {
            type: 'number',
            value: 'subtotal * (fields.discountPercent / 100)',
          },
          finalAmount: {
            type: 'money',
            label: 'Final Amount',
            description: 'After discount',
            value: {
              amount: 'subtotal - discount',
              currency: 'fields.unitPrice.currency',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: {
          quantity: 2,
          unitPrice: { amount: 100, currency: 'EUR' },
          discountPercent: 10,
        },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.defsValues.get('subtotal')).toBe(200)
        expect(result.value.defsValues.get('discount')).toBe(20)
        const final = result.value.defsValues.get('finalAmount') as {
          amount: number
          currency: string
        }
        expect(final.amount).toBe(180)
        expect(final.currency).toBe('EUR')
      }
    })
  })

  // ============================================================================
  // getDefsValues Tests
  // ============================================================================

  describe('getDefsValues helper', () => {
    test('returns evaluated logic values as Map', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          age: { type: 'number' },
        },
        defs: {
          isAdult: { type: 'boolean', value: 'fields.age >= 18' },
          ageGroup: {
            type: 'string',
            value: 'fields.age < 18 ? "minor" : "adult"',
          },
        },
      }

      const values = getDefsValues(form, { fields: { age: 25 } })

      expect(values.get('isAdult')).toBe(true)
      expect(values.get('ageGroup')).toBe('adult')
    })

    test('returns evaluated object logic values', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          quantity: { type: 'number' },
          price: { type: 'number' },
        },
        defs: {
          total: {
            type: 'money',
            value: {
              amount: 'fields.quantity * fields.price',
              currency: '"USD"',
            },
          },
        },
      }

      const values = getDefsValues(form, { fields: { quantity: 3, price: 15 } })

      const total = values.get('total') as { amount: number; currency: string }
      expect(total.amount).toBe(45)
      expect(total.currency).toBe('USD')
    })
  })

  // ============================================================================
  // Field Visibility Tests with Object Logic
  // ============================================================================

  describe('field visibility with object logic', () => {
    test('object logic values can be used in visibility expressions', () => {
      const form: Form = {
        kind: 'form',
        name: 'test-form',
        version: '1.0.0',
        title: 'Test',
        fields: {
          quantity: { type: 'number' },
          price: { type: 'number' },
          specialDiscount: {
            type: 'number',
            visible: 'totalAmount.amount > 1000',
            required: 'totalAmount.amount > 1000',
          },
        },
        defs: {
          totalAmount: {
            type: 'money',
            value: {
              amount: 'fields.quantity * fields.price',
              currency: '"USD"',
            },
          },
        },
      }

      const result = evaluateFormDefs(form, {
        fields: { quantity: 10, price: 150 },
      })

      expect('value' in result).toBe(true)
      if ('value' in result) {
        const discountField = result.value.fields.get('specialDiscount')
        expect(discountField?.visible).toBe(true)
        expect(discountField?.required).toBe(true)
      }
    })
  })
})
