/**
 * core-053: validateFieldInput treats '__proto__' (and 'constructor') as a known field.
 * Input: validateFieldInput(form, { fieldPath: '__proto__', value: { polluted: 1 } }).
 * Expected: failure "Unknown field path" like any other unknown path.
 * Actual (screened commit): { success: true, value: { polluted: 1 } }.
 */
import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import { validateFieldInput } from '@/validation/progressive'

const f = form().name('f').version('1.0.0').title('F').fields({ a: { type: 'text', label: 'A' } }).build()

describe('core-053', () => {
	test('control: an unknown path fails', () => {
		expect(validateFieldInput(f, { fieldPath: 'nope', value: 1 }).success).toBe(false)
	})
	test.each(['__proto__', 'constructor', 'toString'])('%s is not a known field', (fieldPath) => {
		const r = validateFieldInput(f, { fieldPath, value: { polluted: 1 } })
		expect(r.success).toBe(false)
	})
})
