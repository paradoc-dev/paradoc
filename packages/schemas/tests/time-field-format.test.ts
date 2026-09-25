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

	it('requires seconds in time bounds', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', min: '09:00', max: '10:00:00' }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'time', min: '09:00:00', max: '10:00:00' }).success).toBe(true)
	})

	it('accepts a valid HH:MM:SS.fff default', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', default: '10:00:00.500' }).success).toBe(true)
	})

	it('rejects reversed bounds once both parse to the same padded precision', () => {
		expect(FormFieldSchema.safeParse({ type: 'time', min: '10:00:01', max: '10:00:00' }).success).toBe(false)
	})
})

describe('datetime field format', () => {
	it('requires seconds and an explicit timezone in defaults and bounds', () => {
		expect(FormFieldSchema.safeParse({ type: 'datetime', default: '2026-09-25T14:30:00' }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'datetime', default: '2026-09-25T14:30Z' }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'datetime', min: '2026-09-25T14:30:00Z' }).success).toBe(true)
		expect(FormFieldSchema.safeParse({ type: 'datetime', max: '2026-09-25T14:30:00.500-04:00' }).success).toBe(true)
	})
})
