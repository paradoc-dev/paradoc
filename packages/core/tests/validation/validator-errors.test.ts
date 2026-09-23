import { describe, expect, it } from 'vitest'
import { getValidatorErrors, validateForm, validatePhone } from '../../src/validation'

describe('getValidatorErrors', () => {
	it('returns the errors from the last failed run of the named validator', () => {
		expect(validateForm({ totally: 'not a form' })).toBe(false)

		const errors = getValidatorErrors('form')
		expect(errors).not.toBeNull()
		expect(errors!.length).toBeGreaterThan(0)
		expect(errors).toBe(validateForm.errors)
	})

	it('returns null after the named validator passes', () => {
		validatePhone({ number: 5 })
		expect(getValidatorErrors('phone')).not.toBeNull()

		expect(validatePhone({ number: '+15555550100' })).toBe(true)
		expect(getValidatorErrors('phone')).toBeNull()
	})

	it('returns null for an unknown validator key', () => {
		expect(getValidatorErrors('Form')).toBeNull()
		expect(getValidatorErrors('toString')).toBeNull()
		expect(getValidatorErrors('')).toBeNull()
	})
})
