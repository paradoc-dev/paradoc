/**
 * core-027: isValid() was documented as checking rules only. It returns
 * validate().valid, which also counts value and requiredness errors.
 * Input: a draft with a required field left unfilled and no rules.
 * Expected: isValid() is false and agrees with validate().valid; filling the
 * field makes both true.
 */
import { expect, test } from 'vitest'
import { form } from '@/artifacts'

const lease = () =>
	form()
		.name('lease')
		.version('1.0.0')
		.title('Lease')
		.fields({ tenantName: { type: 'text', label: 'Tenant name', required: true } })
		.build()

test('core-027 a missing required field makes isValid() false with no rules declared', () => {
	const draft = lease().fill()
	expect(draft.validateRules().valid).toBe(true)
	expect(draft.isValid()).toBe(false)
	expect(draft.isValid()).toBe(draft.validate().valid)
})

test('core-027 a complete draft is valid', () => {
	const draft = lease().fill({ fields: { tenantName: 'Ada' } })
	expect(draft.isValid()).toBe(true)
	expect(draft.validate().valid).toBe(true)
})
