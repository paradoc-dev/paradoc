import { describe, expect, it } from 'vitest'
import { FormFieldSchema } from '../src/zod'

// Regression for issue:time-field-bounds-and-default-are (audit finding schemas-005).
// Time field min, max, and default were unvalidated strings, so a value like
// 'noon' passed the schema and only failed later, at fill time, in core.
describe('time field format', () => {
	it('rejects a time default that is not a time', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', default: 'noon' }).success).toBe(false)
	})

	it('rejects time bounds that are not times', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', min: 'noon', max: 'later' }).success).toBe(false)
	})

	it('accepts valid HH:MM and HH:MM:SS bounds', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', min: '09:00', max: '10:00:00' }).success).toBe(true)
	})

	it('accepts a valid HH:MM:SS.fff default', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', default: '10:00:00.500' }).success).toBe(true)
	})

	it('rejects reversed bounds once both parse to the same padded precision', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', min: '10:00:01', max: '10:00:00' }).success).toBe(false)
	})
})
