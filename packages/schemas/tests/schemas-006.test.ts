/**
 * schemas-006: rating step 0 is accepted.
 * Input: { type:'rating', step:0 }
 * Expected: rejected, as { type:'number', step:0 } is.
 * Actual: accepted; core then maps step to multipleOf(0) and every fill fails with
 *         "Invalid number: must be a multiple of 0" (checked with core dist, value 3).
 */
import { describe, expect, it } from 'vitest'
import { FormFieldSchema } from '../src/zod'

describe('schemas-006', () => {
	it('rejects a zero or negative rating step', () => {
		expect(FormFieldSchema.safeParse({ type: 'number', step: 0 }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'rating', step: 0 }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'rating', step: -1 }).success).toBe(false)
	})

	it('accepts a positive rating step', () => {
		expect(FormFieldSchema.safeParse({ type: 'rating', step: 0.5 }).success).toBe(true)
	})
})
