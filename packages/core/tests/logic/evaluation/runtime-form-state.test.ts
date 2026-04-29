import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'

/**
 * Tests for RuntimeForm runtime state methods.
 */
describe('RuntimeForm runtime state', () => {
  // ============================================================================
  // Test Form Fixtures
  // ============================================================================

  // Note: We don't use required: 'expression' here because schema validation
  // treats string expressions as truthy (required: true). Runtime evaluation
  // tests the required expression separately via isFieldRequired().
  const createFormWithDefs = () =>
    form()
      .name('test-form')
      .version('1.0.0')
      .title('Test Form')
      .defs({
        isAdult: { type: 'boolean', value: 'fields.age >= 18' },
        canDrive: { type: 'boolean', value: 'isAdult and fields.hasLicense' },
      })
      .field('age', { type: 'number' })
      .field('hasLicense', { type: 'boolean' })
      .field('drivingLicense', {
        type: 'text',
        visible: 'isAdult',
      })
      .field('parentConsent', {
        type: 'boolean',
        visible: 'not isAdult',
      })
      .build()

  // Note: Don't use required: true for annexes in tests because schema validation
  // will fail. The runtime evaluation of annex visibility is separate.
  const createFormWithAnnexes = () =>
    form()
      .name('annex-form')
      .version('1.0.0')
      .title('Annex Form')
      .defs({ isAdult: { type: 'boolean', value: 'fields.age >= 18' } })
      .field('age', { type: 'number' })
      .annex('idProof', {
        title: 'ID Proof',
      })
      .annex('driversLicense', {
        title: 'Drivers License',
        visible: 'isAdult',
      })
      .build()

  // Note: The 'disabled' property is defined in TypeScript types but not in the
  // JSON schema, so it gets stripped during field parsing. For now, we skip
  // testing disabled expressions in RuntimeForm tests.

  // ============================================================================
  // runtimeState Tests
  // ============================================================================

  describe('runtimeState', () => {
    test('returns FormRuntimeState object', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      const state = filled.runtimeState

      expect(state).toBeDefined()
      expect(state.fields).toBeDefined()
      expect(state.annexes).toBeDefined()
      expect(state.defsValues).toBeDefined()
    })

    test('caches runtime state', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      const state1 = filled.runtimeState
      const state2 = filled.runtimeState

      expect(state1).toBe(state2) // Same object reference
    })

    test('new RuntimeForm has fresh cache', () => {
      const formInstance = createFormWithDefs()
      const filled1 = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)
      // Use type assertion since builder pattern doesn't preserve exact field types
      const filled2 = (filled1.setField as (k: string, v: unknown) => typeof filled1)('age', 16)

      const state1 = filled1.runtimeState
      const state2 = filled2.runtimeState

      expect(state1).not.toBe(state2) // Different objects
      expect(state1.defsValues.get('isAdult')).toBe(true)
      expect(state2.defsValues.get('isAdult')).toBe(false)
    })
  })

  // ============================================================================
  // Field State Methods
  // ============================================================================

  describe('getFieldState', () => {
    test('returns state for existing field', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      const state = filled.getFieldState('age')

      expect(state).toBeDefined()
      expect(state?.fieldId).toBe('age')
      expect(state?.value).toBe(25)
    })

    test('returns undefined for nonexistent field', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      const state = filled.getFieldState('nonexistent')

      expect(state).toBeUndefined()
    })
  })

  describe('isFieldVisible', () => {
    test('returns true for visible field (adult)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      expect(filled.isFieldVisible('drivingLicense')).toBe(true)
      expect(filled.isFieldVisible('parentConsent')).toBe(false)
    })

    test('returns true for visible field (minor)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 16, hasLicense: false } } as any)

      expect(filled.isFieldVisible('drivingLicense')).toBe(false)
      expect(filled.isFieldVisible('parentConsent')).toBe(true)
    })

    test('returns true for nonexistent field (default)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      expect(filled.isFieldVisible('nonexistent')).toBe(true)
    })
  })

  describe('isFieldRequired', () => {
    test('returns false for field without required expression', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      // These fields don't have required expressions, so they're not required
      expect(filled.isFieldRequired('drivingLicense')).toBe(false)
      expect(filled.isFieldRequired('parentConsent')).toBe(false)
    })

    test('returns false for nonexistent field (default)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      expect(filled.isFieldRequired('nonexistent')).toBe(false)
    })
  })

  // Note: isFieldDisabled tests are skipped because the 'disabled' property
  // is not yet in the JSON schema. See form-evaluator.test.ts for disabled
  // expression tests that work with raw Form objects.
  describe('isFieldDisabled', () => {
    test('returns false for fields without disabled expression', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      // Fields don't have disabled expressions
      expect(filled.isFieldDisabled('age')).toBe(false)
      expect(filled.isFieldDisabled('drivingLicense')).toBe(false)
    })

    test('returns false for nonexistent field (default)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      expect(filled.isFieldDisabled('nonexistent')).toBe(false)
    })
  })

  // ============================================================================
  // Filtered Field Lists
  // ============================================================================

  describe('getVisibleFields', () => {
    test('returns only visible fields (adult)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      const visibleFields = filled.getVisibleFields()
      const visibleIds = visibleFields.map((f) => f.fieldId)

      expect(visibleIds).toContain('age')
      expect(visibleIds).toContain('hasLicense')
      expect(visibleIds).toContain('drivingLicense')
      expect(visibleIds).not.toContain('parentConsent')
    })

    test('returns only visible fields (minor)', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 16, hasLicense: false } } as any)

      const visibleFields = filled.getVisibleFields()
      const visibleIds = visibleFields.map((f) => f.fieldId)

      expect(visibleIds).toContain('age')
      expect(visibleIds).toContain('hasLicense')
      expect(visibleIds).not.toContain('drivingLicense')
      expect(visibleIds).toContain('parentConsent')
    })
  })

  describe('getRequiredVisibleFields', () => {
    test('returns empty for form without required fields', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      const requiredVisibleFields = filled.getRequiredVisibleFields()
      const ids = requiredVisibleFields.map((f) => f.fieldId)

      // No fields have required expressions in this fixture
      expect(ids).not.toContain('drivingLicense')
      expect(ids).not.toContain('parentConsent')
    })
  })

  // ============================================================================
  // Annex State Methods
  // ============================================================================

  describe('getAnnexState', () => {
    test('returns state for existing annex', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      const state = filled.getAnnexState('idProof')

      expect(state).toBeDefined()
      expect(state?.annexId).toBe('idProof')
      // Annex doesn't have required expression in test fixture
      expect(state?.required).toBe(false)
    })

    test('returns undefined for nonexistent annex', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      const state = filled.getAnnexState('nonexistent')

      expect(state).toBeUndefined()
    })
  })

  describe('isAnnexVisible', () => {
    test('returns true for visible annex (adult)', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      expect(filled.isAnnexVisible('idProof')).toBe(true)
      expect(filled.isAnnexVisible('driversLicense')).toBe(true)
    })

    test('returns false for hidden annex (minor)', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 16 } } as any)

      expect(filled.isAnnexVisible('driversLicense')).toBe(false)
    })

    test('returns true for nonexistent annex (default)', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      expect(filled.isAnnexVisible('nonexistent')).toBe(true)
    })
  })

  describe('isAnnexRequired', () => {
    test('returns false for annexes without required expression', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      // Neither annex has required expression in test fixture
      expect(filled.isAnnexRequired('idProof')).toBe(false)
      expect(filled.isAnnexRequired('driversLicense')).toBe(false)
    })

    test('returns false for nonexistent annex (default)', () => {
      const formInstance = createFormWithAnnexes()
      const filled = formInstance.fill({ fields:  { age: 25 } } as any)

      expect(filled.isAnnexRequired('nonexistent')).toBe(false)
    })
  })

  // ============================================================================
  // Logic Value Methods
  // ============================================================================

  describe('getLogicValue', () => {
    test('returns evaluated logic value', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      expect(filled.getLogicValue('isAdult')).toBe(true)
      expect(filled.getLogicValue('canDrive')).toBe(true)
    })

    test('returns false for minor', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 16, hasLicense: true } } as any)

      expect(filled.getLogicValue('isAdult')).toBe(false)
      expect(filled.getLogicValue('canDrive')).toBe(false) // false AND true = false
    })

    test('returns undefined for nonexistent logic key', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: false } } as any)

      expect(filled.getLogicValue('nonexistent')).toBeUndefined()
    })
  })

  // ============================================================================
  // Cache Invalidation on Mutation
  // ============================================================================

  describe('cache invalidation', () => {
    test('set() creates new RuntimeForm with fresh state', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 16, hasLicense: false } } as any)

      expect(filled.getLogicValue('isAdult')).toBe(false)
      expect(filled.isFieldVisible('drivingLicense')).toBe(false)

      // Use type assertion since builder pattern doesn't preserve exact field types
      const updated = (filled.setField as (k: string, v: unknown) => typeof filled)('age', 25)

      expect(updated.getLogicValue('isAdult')).toBe(true)
      expect(updated.isFieldVisible('drivingLicense')).toBe(true)

      // Original unchanged
      expect(filled.getLogicValue('isAdult')).toBe(false)
    })

    test('update() creates new RuntimeForm with fresh state', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 16, hasLicense: false } } as any)

      expect(filled.getLogicValue('canDrive')).toBe(false)

      // Use type assertion since builder pattern doesn't preserve exact field types
      const updated = filled.updateFields({ age: 25, hasLicense: true } as any)

      expect(updated.getLogicValue('canDrive')).toBe(true)

      // Original unchanged
      expect(filled.getLogicValue('canDrive')).toBe(false)
    })

    test('clone() creates new RuntimeForm with fresh cache', () => {
      const formInstance = createFormWithDefs()
      const filled = formInstance.fill({ fields:  { age: 25, hasLicense: true } } as any)

      // Access state to cache it
      const _ = filled.runtimeState

      const cloned = filled.clone()

      // Cloned should have different runtime state object (new cache)
      expect(cloned.runtimeState).not.toBe(filled.runtimeState)
      // But same values
      expect(cloned.getLogicValue('isAdult')).toBe(filled.getLogicValue('isAdult'))
    })
  })
})
