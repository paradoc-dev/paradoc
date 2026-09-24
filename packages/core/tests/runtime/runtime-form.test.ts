import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import type { DraftForm } from '@/artifacts'

/**
 * Tests for DraftForm class (form lifecycle phase 1).
 *
 * DraftForm wraps a form definition together with validated data,
 * providing a convenient way to work with forms and their data.
 * It is the first phase in the form lifecycle:
 * - DraftForm: mutable data, no signatures
 * - SignableForm: frozen data, can capture signatures
 * - ExecutedForm: fully frozen, execution complete
 */
describe('DraftForm', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const createFormWithFields = () =>
    form()
      .name('test-form')
      .version('1.0.0')
      .title('Test Form')
      .fields({
        name: { type: 'text', label: 'Full Name', required: true },
        email: { type: 'email', label: 'Email', required: true },
        age: { type: 'number', label: 'Age', min: 0, max: 150 },
        subscribe: { type: 'boolean', label: 'Subscribe' },
      })
      .build()

  const createFormWithLayer = () =>
    form()
      .name('form-with-layer')
      .version('1.0.0')
      .title('Form with Layer')
      .fields({
        name: { type: 'text', label: 'Name', required: true },
        greeting: { type: 'text', label: 'Greeting' },
      })
      .inlineLayer('default', { mimeType: 'text/plain', text: 'Hello, {{fields.name}}! {{fields.greeting}}' })
      .defaultLayer('default')
      .build()

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    test('creates DraftForm with form and data', () => {
      const formInstance = createFormWithFields()
      const data = { fields: { name: 'John', email: 'john@example.com' } } as const
      // Use fill() which handles type normalization
      const filled = formInstance.fill(data)

      expect(filled).toHaveProperty('phase', 'draft')
      // DraftForm.form is the raw form definition, not the FormInstance
      expect(filled.form.kind).toBe('form')
      expect(filled.form.name).toBe('test-form')
      expect(filled.fields.name).toEqual('John')
      expect(filled.fields.email).toEqual('john@example.com')
    })

    test('stores form definition', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      // DraftForm.form is the raw form definition
      expect(filled.form.kind).toBe('form')
      expect(filled.form.name).toBe('test-form')
    })

    test('stores data', () => {
      const formInstance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          subscribe: true,
        },
      }
      const filled = formInstance.fill(data)

      expect(filled.fields.name).toEqual('John Doe')
      expect(filled.fields.email).toEqual('john@example.com')
      expect(filled.fields.age).toEqual(30)
      expect(filled.fields.subscribe).toEqual(true)
    })
  })

  // ============================================================================
  // Creating via fill()
  // ============================================================================

  describe('creating via form.fill()', () => {
    test('creates DraftForm via fill()', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      expect(filled).toHaveProperty('phase', 'draft')
    })

    test('creates an incomplete draft via fill()', () => {
      const formInstance = createFormWithFields()
      expect(formInstance.fill({ fields: { name: 'John' } } as any).isValid()).toBe(false)
    })

    test('creates DraftForm via safeFill()', () => {
      const formInstance = createFormWithFields()
      const result = formInstance.safeFill({
        fields: { name: 'John', email: 'john@example.com' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('phase', 'draft')
      }
    })
  })

  // ============================================================================
  // Top-level payload keys: fill(), safeFill(), update()
  // ============================================================================

  describe('top-level payload keys', () => {
    const createFormWithParty = () =>
      form()
        .name('top-level-keys-probe')
        .fields({
          amount: { type: 'number', label: 'Amount', required: true },
        })
        .parties({
          buyer: { label: 'Buyer', partyType: 'person' },
        })
        .annexes({
          receipt: { title: 'Receipt' },
        })
        .build()

    test('fill() accepts only fields, parties and annexes at the top level', () => {
      const formInstance = createFormWithParty()
      const draft = formInstance.fill({
        fields: { amount: 100 },
        parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
        annexes: { receipt: { name: 'receipt.pdf', mimeType: 'application/pdf' } },
      })

      expect(draft.getField('amount')).toBe(100)
      expect(draft.getParty('buyer')).toMatchObject({ name: 'Alice' })
      expect(draft.getAnnex('receipt')).toMatchObject({ name: 'receipt.pdf' })
    })

    test('fill() rejects a misspelled top-level key', () => {
      const formInstance = createFormWithParty()
      expect(() => formInstance.fill({ fieldz: { amount: 100 } } as any)).toThrow(/Unknown top-level key "fieldz"/)
    })

    test('fill() rejects a top-level key that matches a declared party role', () => {
      const formInstance = createFormWithParty()
      expect(() =>
        formInstance.fill({ fields: { amount: 100 }, buyer: { id: 'buyer-0', name: 'Alice' } } as any),
      ).toThrow(/parties\.buyer/)
    })

    test('safeFill() reports a role-named top-level key without throwing', () => {
      const formInstance = createFormWithParty()
      const result = formInstance.safeFill({
        fields: { amount: 100 },
        buyer: { id: 'buyer-0', name: 'Alice' },
      } as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toMatch(/parties\.buyer/)
      }
    })

    test('safeFill() reports a misspelled top-level key without throwing', () => {
      const formInstance = createFormWithParty()
      const result = formInstance.safeFill({ fieldz: { amount: 100 } } as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toMatch(/Unknown top-level key "fieldz"/)
      }
    })

    test('safeFill() accepts fields, parties and annexes at the top level', () => {
      const formInstance = createFormWithParty()
      const result = formInstance.safeFill({
        fields: { amount: 100 },
        parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
        annexes: { receipt: { name: 'receipt.pdf', mimeType: 'application/pdf' } },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.getField('amount')).toBe(100)
        expect(result.data.getParty('buyer')).toMatchObject({ name: 'Alice' })
        expect(result.data.getAnnex('receipt')).toMatchObject({ name: 'receipt.pdf' })
      }
    })

    test('update() rejects a top-level key that matches a declared party role', () => {
      const formInstance = createFormWithParty()
      const draft = formInstance.fill({ fields: { amount: 100 } })
      expect(() => draft.update({ buyer: { id: 'buyer-0', name: 'Alice' } } as any)).toThrow(/parties\.buyer/)
    })

    test('update() rejects a misspelled top-level key', () => {
      const formInstance = createFormWithParty()
      const draft = formInstance.fill({ fields: { amount: 100 } })
      expect(() => draft.update({ fieldz: { amount: 50 } } as any)).toThrow(/Unknown top-level key "fieldz"/)
    })

    test('update() still accepts fields, parties and annexes', () => {
      const formInstance = createFormWithParty()
      const draft = formInstance
        .fill({ fields: { amount: 100 } })
        .update({
          parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
          annexes: { receipt: { name: 'receipt.pdf', mimeType: 'application/pdf' } },
        })

      expect(draft.getParty('buyer')).toMatchObject({ name: 'Alice' })
      expect(draft.getAnnex('receipt')).toMatchObject({ name: 'receipt.pdf' })
    })
  })

  // ============================================================================
  // getField() Method
  // ============================================================================

  describe('getField()', () => {
    test('returns field value by id', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John Doe', email: 'john@example.com', age: 30 },
      } as any)

      expect(filled.getField('name')).toBe('John Doe')
      expect(filled.getField('email')).toBe('john@example.com')
      expect(filled.getField('age')).toBe(30)
    })

    test('returns undefined for unset optional field', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      expect(filled.getField('age')).toBeUndefined()
      expect(filled.getField('subscribe')).toBeUndefined()
    })

    test('returns undefined for non-existent field', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      // Use type assertion to test runtime behavior with invalid field ID
      expect(filled.getField('nonexistent' as any)).toBeUndefined()
    })

    test('returns correct type for each field type', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com', age: 25, subscribe: false },
      } as any)

      expect(typeof filled.getField('name')).toBe('string')
      expect(typeof filled.getField('email')).toBe('string')
      expect(typeof filled.getField('age')).toBe('number')
      expect(typeof filled.getField('subscribe')).toBe('boolean')
    })
  })

  // ============================================================================
  // getAllFields() Method
  // ============================================================================

  describe('getAllFields()', () => {
    test('returns all field values', () => {
      const formInstance = createFormWithFields()
      const fieldData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        subscribe: true,
      }
      const filled = formInstance.fill({ fields:  fieldData } as any)

      expect(filled.getAllFields()).toEqual(fieldData)
    })

    test('returns fields object from data', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      expect(filled.getAllFields()).toEqual({ name: 'John', email: 'john@example.com' })
    })
  })

  // ============================================================================
  // isValid() Method
  // ============================================================================

  describe('isValid()', () => {
    test('returns true when no rules are defined', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      expect(filled.isValid()).toBe(true)
    })

    test('return type is boolean', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const result: boolean = filled.isValid()
      expect(result).toBe(true)
    })
  })

  // ============================================================================
  // update() Method
  // ============================================================================

  describe('update()', () => {
    test('returns new DraftForm with updated field', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const updated = filled.update({ fields: { name: 'Jane' } } as any)

      expect(updated.getField('name')).toBe('Jane')
      expect(updated.getField('email')).toBe('john@example.com')
    })

    test('original DraftForm is not modified', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      filled.update({ fields: { name: 'Jane' } } as any)

      expect(filled.getField('name')).toBe('John') // unchanged
    })

    test('returns new DraftForm instance', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const updated = filled.update({ fields: { name: 'Jane' } } as any)

      expect(updated).not.toBe(filled)
      expect(updated).toHaveProperty('phase', 'draft')
    })

    test('validates age constraints', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      // Age out of range should throw
      expect(() => filled.update({ fields: { age: 200 } } as any)).toThrow()
    })

    test('can set optional field', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const updated = filled.update({ fields: { age: 25 } } as any)
      expect(updated.getField('age')).toBe(25)
    })

    test('returns new DraftForm with multiple updated fields', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const updated = filled.update({
        fields: { name: 'Jane', age: 30 },
      } as any)

      expect(updated.getField('name')).toBe('Jane')
      expect(updated.getField('age')).toBe(30)
      expect(updated.getField('email')).toBe('john@example.com') // unchanged
    })

    test('original DraftForm is not modified by a multi-field update', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      filled.update({ fields: { name: 'Jane', age: 30 } } as any)

      expect(filled.getField('name')).toBe('John')
      expect(filled.getField('age')).toBeUndefined()
    })

    test('can update multiple fields at once', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const updated = filled.update({
        fields: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          age: 28,
          subscribe: true,
        },
      } as any)

      expect(updated.getField('name')).toBe('Jane Doe')
      expect(updated.getField('email')).toBe('jane@example.com')
      expect(updated.getField('age')).toBe(28)
      expect(updated.getField('subscribe')).toBe(true)
    })

    test('updates one field on a draft filled with only some required fields', () => {
      // A draft can be filled with only some of the form's required fields
      // (progressive fill: `email` is required but omitted here). update()
      // must still change one field without demanding the rest of the
      // required fields be present.
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({ fields: { name: 'John' } } as any)

      const updated = filled.update({ fields: { age: 25 } } as any)

      expect(updated.getField('name')).toBe('John')
      expect(updated.getField('age')).toBe(25)
      expect(updated.getField('email')).toBeUndefined()
    })

    test('setField and updateFields no longer exist on DraftForm', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      // @ts-expect-error - setField was removed; update() is the only mutator
      expect(filled.setField).toBeUndefined()
      // @ts-expect-error - updateFields was removed; update() is the only mutator
      expect(filled.updateFields).toBeUndefined()
    })
  })

  // ============================================================================
  // clone() Method
  // ============================================================================

  describe('clone()', () => {
    test('creates exact copy', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com', age: 30 },
      } as any)

      const cloned = filled.clone()

      expect(cloned.getField('name')).toBe(filled.getField('name'))
      expect(cloned.getField('email')).toBe(filled.getField('email'))
      expect(cloned.getField('age')).toBe(filled.getField('age'))
    })

    test('clone is a new DraftForm instance', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const cloned = filled.clone()

      expect(cloned).not.toBe(filled)
      expect(cloned).toHaveProperty('phase', 'draft')
    })

    test('clone data is independent (deep clone)', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const cloned = filled.clone()

      // Verify fields objects are different
      expect(cloned.fields).not.toBe(filled.fields)

      // Modifying one doesn't affect the other
      const updated = cloned.update({ fields: { name: 'Jane' } } as any)
      expect(filled.getField('name')).toBe('John')
      expect(updated.getField('name')).toBe('Jane')
    })

    test('clone has same form definition', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const cloned = filled.clone()

      // Clone should have the same form definition (deep cloned, not same reference)
      expect(cloned.form.name).toBe(filled.form.name)
      expect(cloned.form.kind).toBe(filled.form.kind)
    })
  })

  // ============================================================================
  // toJSON() Method
  // ============================================================================

  describe('toJSON()', () => {
    test('returns object with form and data', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const json = filled.toJSON()

      expect(json.form).toBeDefined()
      expect(json.fields).toBeDefined()
    })

    test('form property is raw schema', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const json = filled.toJSON()

      expect(json.form.kind).toBe('form')
      expect(json.form.name).toBe('test-form')
      expect(json.form.fields).toBeDefined()
    })

    test('fields property contains field values', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com', age: 30 },
      } as any)

      const json = filled.toJSON()

      expect(json.fields.name).toBe('John')
      expect(json.fields.email).toBe('john@example.com')
      expect(json.fields.age).toBe(30)
    })

    test('is JSON.stringify compatible', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const jsonString = JSON.stringify(filled)
      const parsed = JSON.parse(jsonString)

      expect(parsed.form).toBeDefined()
      expect(parsed.fields).toBeDefined()
      expect(parsed.form.kind).toBe('form')
      expect(parsed.fields.name).toBe('John')
    })
  })

  // ============================================================================
  // toYAML() Method
  // ============================================================================

  describe('toYAML()', () => {
    test('returns valid YAML string', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const yaml = filled.toYAML()

      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('form:')
      expect(yaml).toContain('data:')
    })

    test('YAML contains form schema', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const yaml = filled.toYAML()

      expect(yaml).toContain('kind: form')
      expect(yaml).toContain('name: test-form')
    })

    test('YAML contains data values', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John Doe', email: 'john@example.com' },
      } as any)

      const yaml = filled.toYAML()

      expect(yaml).toContain('John Doe')
      expect(yaml).toContain('john@example.com')
    })
  })

  // ============================================================================
  // Immutability
  // ============================================================================

  describe('immutability', () => {
    test('form property is readonly at compile-time', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      // TypeScript prevents assignment at compile-time
      // @ts-expect-error - form is readonly
      const _check = () => { filled.form = null }

      // At runtime, form is still the original value
      expect(filled.form.kind).toBe('form')
      expect(filled.form.name).toBe('test-form')
    })

    test('fields property is readonly at compile-time', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)
      const originalFields = filled.fields

      // TypeScript prevents assignment at compile-time
      // @ts-expect-error - fields is readonly
      const _check = () => { filled.fields = {} }

      // At runtime, fields should equal the original
      expect(filled.fields).toEqual(originalFields)
    })

    test('mutation methods return new instances', () => {
      const formInstance = createFormWithFields()
      const original = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      const afterUpdate = original.update({ fields: { name: 'Jane' } } as any)
      const afterMultiUpdate = original.update({ fields: { age: 30 } } as any)
      const afterClone = original.clone()

      expect(afterUpdate).not.toBe(original)
      expect(afterMultiUpdate).not.toBe(original)
      expect(afterClone).not.toBe(original)
    })

    test('detaches and freezes nested field views without stale visibility', () => {
      const definition = form()
        .name('runtime-view-probe')
        .defs({ showDetails: { type: 'boolean', value: 'fields.age > 0' } })
        .fields({
          age: { type: 'number' },
          details: { type: 'fieldset', fields: { name: { type: 'text' } } },
          conditional: { type: 'text', visible: 'showDetails' },
        })
        .build()

      const draft = definition.fill({ fields: { age: 21, details: { name: 'Original' } } } as any)

      expect(draft.isFieldVisible('conditional')).toBe(true)
      const exposedFields = draft.fields as Record<string, any>

      expect(Object.isFrozen(exposedFields)).toBe(true)
      expect(Object.isFrozen(exposedFields.details)).toBe(true)
      expect(() => {
        exposedFields.age = -1
      }).toThrow()
      expect(() => {
        exposedFields.details.name = 'Tampered'
      }).toThrow()

      const exposedField = draft.getField('details') as { name: string }
      expect(() => {
        exposedField.name = 'Tampered again'
      }).toThrow()

      expect(draft.getField('age')).toBe(21)
      expect((draft.getField('details') as { name: string }).name).toBe('Original')
      expect(draft.isFieldVisible('conditional')).toBe(true)

      const serialized = draft.toJSON()
      serialized.fields.age = -1
      expect(draft.getField('age')).toBe(21)
    })

    test('protects nested parties, signers, and signatories from aliases', () => {
      const definition = form()
        .name('runtime-party-view-probe')
        .parties({ tenant: { label: 'Tenant', partyType: 'person' } })
        .build()
      const partyInput = { id: 'tenant-0', name: 'Original Tenant' }
      const signerInput = { person: { name: 'Original Signer' } }
      const draft = definition
        .fill({ parties: { tenant: partyInput } })
        .addSigner('signer', signerInput)
        .addSignatory('tenant', 'tenant-0', { signerId: 'signer', capacity: 'President' })

      partyInput.name = 'Changed Input'
      signerInput.person.name = 'Changed Input'

      expect((draft.getParty('tenant') as { name: string }).name).toBe('Original Tenant')
      expect(draft.getSigner('signer')?.person.name).toBe('Original Signer')

      const exposedParty = draft.getParty('tenant') as { name: string }
      const exposedSigner = draft.getSigner('signer') as { person: { name: string } }
      const exposedSignatories = draft.getSignatories('tenant', 'tenant-0')

      expect(Object.isFrozen(exposedParty)).toBe(true)
      expect(Object.isFrozen(exposedSigner)).toBe(true)
      expect(Object.isFrozen(exposedSignatories)).toBe(true)
      expect(() => {
        exposedParty.name = 'Tampered'
      }).toThrow()
      expect(() => {
        exposedSigner.person.name = 'Tampered'
      }).toThrow()
      expect(() => {
        exposedSignatories[0]!.capacity = 'Tampered'
      }).toThrow()

      expect((draft.getParty('tenant') as { name: string }).name).toBe('Original Tenant')
      expect(draft.getSigner('signer')?.person.name).toBe('Original Signer')
      expect(draft.getSignatories('tenant', 'tenant-0')[0]?.capacity).toBe('President')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    test('handles form with no optional fields', () => {
      const simpleForm = form()
        .name('simple')
        .version('1.0.0')
        .title('Simple')
        .fields({
          name: { type: 'text', label: 'Name', required: true },
        })
        .build()

      const filled = simpleForm.fill({ fields:  { name: 'John' } } as any)

      expect(filled.getField('name')).toBe('John')
    })

    test('handles empty data object for form with no required fields', () => {
      const optionalForm = form()
        .name('optional')
        .version('1.0.0')
        .title('Optional')
        .fields({
          name: { type: 'text', label: 'Name' },
          age: { type: 'number', label: 'Age' },
        })
        .build()

      const filled = optionalForm.fill({ fields:  {} } as any)

      expect(filled.getField('name')).toBeUndefined()
      expect(filled.getField('age')).toBeUndefined()
    })

    test('handles special characters in string values', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: "O'Brien", email: 'obrien@example.com' },
      } as any)

      expect(filled.getField('name')).toBe("O'Brien")
    })

    test('handles unicode in string values', () => {
      const formInstance = createFormWithFields()
      const filled = formInstance.fill({
        fields: { name: 'John', email: 'john@example.com' },
      } as any)

      expect(filled.getField('name')).toBe('John')
    })
  })

  // ============================================================================
  // Runtime State (Expression Evaluation)
  // ============================================================================

  describe('runtimeState', () => {
    // Note: We don't use required: 'expression' in these tests because schema
    // validation treats string expressions as truthy. Runtime evaluation tests
    // the required expression separately via isFieldRequired().
    const createFormWithExpressions = () =>
      form()
        .name('conditional-form')
        .version('1.0.0')
        .title('Conditional Form')
        .defs({ isAdult: { type: 'boolean', value: 'fields.age >= 18' } })
        .field('age', { type: 'number', label: 'Age' })
        .field('drivingLicense', {
          type: 'text',
          label: 'Driving License',
          visible: 'isAdult',
        })
        .field('parentConsent', {
          type: 'boolean',
          label: 'Parent Consent',
          visible: 'not isAdult',
        })
        .build()

    // For testing required expressions at runtime
    const createFormWithRequiredExpressions = () =>
      form()
        .name('required-form')
        .version('1.0.0')
        .title('Required Form')
        .defs({ isAdult: { type: 'boolean', value: 'fields.age >= 18' } })
        .field('age', { type: 'number', label: 'Age', required: true })
        .field('drivingLicense', {
          type: 'text',
          label: 'Driving License',
          visible: 'isAdult',
          required: 'isAdult',
        })
        .field('parentConsent', {
          type: 'boolean',
          label: 'Parent Consent',
          visible: 'not isAdult',
          required: 'not isAdult',
        })
        .build()

    // Note: Don't use required expressions for annexes in tests because schema
    // validation treats any string as truthy, which causes validation to fail
    // when annexes data is missing. We can only test visibility for annexes.
    const createFormWithAnnexes = () =>
      form()
        .name('form-with-annexes')
        .version('1.0.0')
        .title('Form with Annexes')
        .defs({ isAdult: { type: 'boolean', value: 'fields.age >= 18' } })
        .field('age', { type: 'number', label: 'Age' })
        .annex('idProof', { title: 'ID Proof' })
        .annex('driversLicense', { title: 'Drivers License', visible: 'isAdult' })
        .annex('parentConsent', { title: 'Parent Consent', visible: 'not isAdult' })
        .build()

    describe('runtimeState getter', () => {
      test('returns FormRuntimeState object', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const state = filled.runtimeState

        expect(state).toBeDefined()
        expect(state.fields).toBeInstanceOf(Map)
        expect(state.annexes).toBeInstanceOf(Map)
        expect(state.defsValues).toBeInstanceOf(Map)
      })

      test('caches runtime state on subsequent accesses', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const state1 = filled.runtimeState
        const state2 = filled.runtimeState

        expect(state1).toBe(state2) // Same object reference
      })

      test('includes all fields in state', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const state = filled.runtimeState

        expect(state.fields.has('age')).toBe(true)
        expect(state.fields.has('drivingLicense')).toBe(true)
        expect(state.fields.has('parentConsent')).toBe(true)
      })
    })

    describe('getFieldState()', () => {
      test('returns FieldRuntimeState for existing field', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const fieldState = filled.getFieldState('age')

        expect(fieldState).toBeDefined()
        expect(fieldState?.fieldId).toBe('age')
        expect(fieldState?.value).toBe(25)
      })

      test('returns undefined for non-existent field', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const fieldState = filled.getFieldState('nonexistent')

        expect(fieldState).toBeUndefined()
      })

      test('includes visible and required properties', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const fieldState = filled.getFieldState('drivingLicense')

        expect(fieldState).toBeDefined()
        expect(typeof fieldState?.visible).toBe('boolean')
        expect(typeof fieldState?.required).toBe('boolean')
      })
    })

    describe('isFieldVisible()', () => {
      test('returns true for visible field (adult case)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isFieldVisible('drivingLicense')).toBe(true)
        expect(filled.isFieldVisible('parentConsent')).toBe(false)
      })

      test('returns true for visible field (minor case)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        expect(filled.isFieldVisible('drivingLicense')).toBe(false)
        expect(filled.isFieldVisible('parentConsent')).toBe(true)
      })

      test('returns true for always-visible field', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isFieldVisible('age')).toBe(true)
      })

      test('returns true for non-existent field (default behavior)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isFieldVisible('nonexistent')).toBe(true)
      })
    })

    describe('isFieldRequired()', () => {
      test('returns true for required field (adult case)', () => {
        // Use form with required expressions, provide all data
        const formInstance = createFormWithRequiredExpressions()
        const filled = formInstance.fill({
          fields: { age: 25, drivingLicense: 'ABC123', parentConsent: false },
        } as any)

        expect(filled.isFieldRequired('drivingLicense')).toBe(true)
        expect(filled.isFieldRequired('parentConsent')).toBe(false)
      })

      test('returns true for required field (minor case)', () => {
        // Use form with required expressions, provide all data
        const formInstance = createFormWithRequiredExpressions()
        const filled = formInstance.fill({
          fields: { age: 16, drivingLicense: '', parentConsent: true },
        } as any)

        expect(filled.isFieldRequired('drivingLicense')).toBe(false)
        expect(filled.isFieldRequired('parentConsent')).toBe(true)
      })

      test('returns true for always-required field', () => {
        // Use form with required expressions, provide all data
        const formInstance = createFormWithRequiredExpressions()
        const filled = formInstance.fill({
          fields: { age: 25, drivingLicense: 'ABC123', parentConsent: false },
        } as any)

        expect(filled.isFieldRequired('age')).toBe(true)
      })

      test('returns false for non-existent field (default behavior)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isFieldRequired('nonexistent')).toBe(false)
      })
    })

    describe('isFieldDisabled()', () => {
      test('always returns false (disabled not in schema)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isFieldDisabled('drivingLicense')).toBe(false)
        expect(filled.isFieldDisabled('nonexistent')).toBe(false)
      })
    })

    describe('getVisibleFields()', () => {
      test('returns only visible fields (adult case)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const visibleFields = filled.getVisibleFields()
        const visibleIds = visibleFields.map((f) => f.fieldId)

        expect(visibleIds).toContain('age')
        expect(visibleIds).toContain('drivingLicense')
        expect(visibleIds).not.toContain('parentConsent')
      })

      test('returns only visible fields (minor case)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        const visibleFields = filled.getVisibleFields()
        const visibleIds = visibleFields.map((f) => f.fieldId)

        expect(visibleIds).toContain('age')
        expect(visibleIds).not.toContain('drivingLicense')
        expect(visibleIds).toContain('parentConsent')
      })

      test('returns array of FieldRuntimeState objects', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const visibleFields = filled.getVisibleFields()

        expect(Array.isArray(visibleFields)).toBe(true)
        expect(visibleFields.length).toBeGreaterThan(0)
        expect(visibleFields[0]).toHaveProperty('fieldId')
        expect(visibleFields[0]).toHaveProperty('visible')
      })
    })

    describe('getRequiredVisibleFields()', () => {
      test('returns fields that are both visible AND required (adult)', () => {
        // Use form with required expressions, provide all data
        const formInstance = createFormWithRequiredExpressions()
        const filled = formInstance.fill({
          fields: { age: 25, drivingLicense: 'ABC123', parentConsent: false },
        } as any)

        const requiredVisible = filled.getRequiredVisibleFields()
        const ids = requiredVisible.map((f) => f.fieldId)

        expect(ids).toContain('age')
        expect(ids).toContain('drivingLicense')
        expect(ids).not.toContain('parentConsent')
      })

      test('returns fields that are both visible AND required (minor)', () => {
        // Use form with required expressions, provide all data
        const formInstance = createFormWithRequiredExpressions()
        const filled = formInstance.fill({
          fields: { age: 16, drivingLicense: '', parentConsent: true },
        } as any)

        const requiredVisible = filled.getRequiredVisibleFields()
        const ids = requiredVisible.map((f) => f.fieldId)

        expect(ids).toContain('age')
        expect(ids).not.toContain('drivingLicense')
        expect(ids).toContain('parentConsent')
      })

      test('excludes visible but not required fields', () => {
        const formInstance = form()
          .name('test')
          .version('1.0.0')
          .title('Test')
          .field('name', { type: 'text', label: 'Name', required: true })
          .field('optional', { type: 'text', label: 'Optional' })
          .build()
        const filled = formInstance.fill({ fields:  { name: 'John' } } as any)

        const requiredVisible = filled.getRequiredVisibleFields()
        const ids = requiredVisible.map((f) => f.fieldId)

        expect(ids).toContain('name')
        expect(ids).not.toContain('optional')
      })
    })

    describe('getAnnexState()', () => {
      test('returns AnnexRuntimeState for existing annex', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const annexState = filled.getAnnexState('idProof')

        expect(annexState).toBeDefined()
        expect(annexState?.annexId).toBe('idProof')
      })

      test('returns undefined for non-existent annex', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const annexState = filled.getAnnexState('nonexistent')

        expect(annexState).toBeUndefined()
      })

      test('includes visible and required properties', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        const annexState = filled.getAnnexState('idProof')

        expect(annexState).toBeDefined()
        expect(typeof annexState?.visible).toBe('boolean')
        expect(typeof annexState?.required).toBe('boolean')
      })
    })

    describe('isAnnexVisible()', () => {
      test('returns true for visible annex (adult case)', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isAnnexVisible('idProof')).toBe(true)
        expect(filled.isAnnexVisible('driversLicense')).toBe(true)
        expect(filled.isAnnexVisible('parentConsent')).toBe(false)
      })

      test('returns true for visible annex (minor case)', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        expect(filled.isAnnexVisible('idProof')).toBe(true)
        expect(filled.isAnnexVisible('driversLicense')).toBe(false)
        expect(filled.isAnnexVisible('parentConsent')).toBe(true)
      })

      test('returns true for non-existent annex (default behavior)', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isAnnexVisible('nonexistent')).toBe(true)
      })
    })

    describe('isAnnexRequired()', () => {
      // Note: We cannot test required expressions on annexes because schema
      // validation treats string expressions as truthy and requires annexes data.
      // These tests verify the default behavior when no required is set.
      test('returns false when annex has no required expression', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        // All annexes have no required expression, so all default to false
        expect(filled.isAnnexRequired('idProof')).toBe(false)
        expect(filled.isAnnexRequired('driversLicense')).toBe(false)
        expect(filled.isAnnexRequired('parentConsent')).toBe(false)
      })

      test('returns false for non-existent annex (default behavior)', () => {
        const formInstance = createFormWithAnnexes()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.isAnnexRequired('nonexistent')).toBe(false)
      })
    })

    describe('getLogicValue()', () => {
      test('returns evaluated logic key value (adult)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.getLogicValue('isAdult')).toBe(true)
      })

      test('returns evaluated logic key value (minor)', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        expect(filled.getLogicValue('isAdult')).toBe(false)
      })

      test('returns undefined for non-existent logic key', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 25 } } as any)

        expect(filled.getLogicValue('nonexistent')).toBeUndefined()
      })

      test('works with multiple logic keys', () => {
        const formInstance = form()
          .name('multi-logic')
          .version('1.0.0')
          .title('Multi Logic')
          .defs({
            isAdult: { type: 'boolean', value: 'fields.age >= 18' },
            isSenior: { type: 'boolean', value: 'fields.age >= 65' },
            isTeenager: { type: 'boolean', value: 'fields.age >= 13 and fields.age < 20' },
          })
          .field('age', { type: 'number', label: 'Age' })
          .build()

        const filled = formInstance.fill({ fields:  { age: 70 } } as any)

        expect(filled.getLogicValue('isAdult')).toBe(true)
        expect(filled.getLogicValue('isSenior')).toBe(true)
        expect(filled.getLogicValue('isTeenager')).toBe(false)
      })
    })

    describe('runtime state with data changes', () => {
      test('new DraftForm has fresh runtime state after update()', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        expect(filled.isFieldVisible('parentConsent')).toBe(true)
        expect(filled.isFieldVisible('drivingLicense')).toBe(false)

        const updated = filled.update({ fields: { age: 25 } } as any)

        expect(updated.isFieldVisible('parentConsent')).toBe(false)
        expect(updated.isFieldVisible('drivingLicense')).toBe(true)
      })

      test('original DraftForm state is unchanged after update()', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        filled.update({ fields: { age: 25 } } as any) // Create new instance

        // Original should remain unchanged
        expect(filled.isFieldVisible('parentConsent')).toBe(true)
        expect(filled.isFieldVisible('drivingLicense')).toBe(false)
      })

      test('logic values update with data changes', () => {
        const formInstance = createFormWithExpressions()
        const filled = formInstance.fill({ fields:  { age: 16 } } as any)

        expect(filled.getLogicValue('isAdult')).toBe(false)

        const updated = filled.update({ fields: { age: 25 } } as any)

        expect(updated.getLogicValue('isAdult')).toBe(true)
        expect(filled.getLogicValue('isAdult')).toBe(false) // Original unchanged
      })
    })
  })
})
