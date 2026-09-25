import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import { datetime, time } from '@/primitives'
import { validateFieldInput } from '@/validation'

// Regression for issue:the-datetime-and-time-primitives-accept (audit finding core-072).
// The datetime and time primitives accepted values that a compiled field of the
// same type rejected. A value a primitive builds or accepts must not fail
// validation on a field of that type.
const f = form().name('drift').fields({
	when: { type: 'datetime' },
	at: { type: 'time' },
}).build()

describe('core-072', () => {
	test.each(['2024-01-01T10:00:00', '2024-01-01T10:00:00+02:00', '2024-01-01T10:00:00Z', '0099-01-01T10:00:00Z'])('datetime %s', (value) => {
		expect(datetime.isValid(value)).toBe(true)
		expect(validateFieldInput(f, { fieldPath: 'when', value }).success).toBe(true)
		expect(f.safeFill({ fields: { when: value } } as never).success).toBe(true)
	})

	test('time 10:00:00.5', () => {
		expect(time.isValid('10:00:00.5')).toBe(true)
		expect(validateFieldInput(f, { fieldPath: 'at', value: '10:00:00.5' }).success).toBe(true)
		expect(f.safeFill({ fields: { at: '10:00:00.5' } } as never).success).toBe(true)
	})

	test('a value the primitive rejects is still rejected by the field', () => {
		expect(datetime.isValid('not-a-datetime')).toBe(false)
		expect(validateFieldInput(f, { fieldPath: 'when', value: 'not-a-datetime' }).success).toBe(false)
		expect(time.isValid('25:00:00')).toBe(false)
		expect(validateFieldInput(f, { fieldPath: 'at', value: '25:00:00' }).success).toBe(false)
	})

	test.each(['2024-02-30T10:00:00Z', '2023-02-29T10:00:00Z', '2024-04-31T00:00:00'])('impossible calendar datetime %s', (value) => {
		expect(datetime.isValid(value)).toBe(false)
		expect(() => datetime(value)).toThrow()
		expect(validateFieldInput(f, { fieldPath: 'when', value }).success).toBe(false)
	})
})
