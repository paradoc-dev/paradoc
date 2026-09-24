/**
 * schemas-009: length and count properties accept negative and fractional numbers.
 * Input: text {minLength:-3,maxLength:2.5}; percentage {precision:-1};
 *        multiselect {min:-1,max:0.5}; party {min:1.5,max:2.5,signature:{witnesses:1.5}}.
 * Expected: all rejected (non-negative integers only).
 * Actual: all accepted.
 */
import { describe, expect, it } from 'vitest'
import { FormFieldSchema, FormPartySchema } from '../src/zod'

describe('schemas-009', () => {
	it.each([
		['text length', { type: 'text', minLength: -3, maxLength: 2.5 }],
		['percentage precision', { type: 'percentage', precision: -1 }],
		['multiselect count', { type: 'multiselect', enum: [{ value: 'a' }], min: -1, max: 0.5 }],
	])('rejects negative or fractional %s', (_name, field) => {
		expect(FormFieldSchema.safeParse(field).success).toBe(false)
	})

	it('rejects fractional party counts', () => {
		expect(FormPartySchema.safeParse({ label: 'x', min: 1.5, max: 2.5, signature: { witnesses: 1.5 } }).success).toBe(false)
	})
})
