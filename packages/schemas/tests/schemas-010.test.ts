/**
 * schemas-010: field pattern passes the schema but throws at fill time.
 * Input: { type:'text', pattern:'(' } and { type:'text', pattern:'(a+)+$' }.
 * Expected: rejected at definition time.
 * Actual: accepted; core validate() also accepts the form, and form(...).fill() throws
 *         UnsafePatternError (checked with core dist).
 */
import { describe, expect, it } from 'vitest'
import { FormFieldSchema } from '../src/zod'

describe('schemas-010', () => {
	it('rejects a pattern that does not compile', () => {
		expect(FormFieldSchema.safeParse({ type: 'text', pattern: '(' }).success).toBe(false)
	})

	it('rejects a ReDoS-prone pattern', () => {
		expect(FormFieldSchema.safeParse({ type: 'text', pattern: '(a+)+$' }).success).toBe(false)
	})

	it('accepts a safe pattern that compiles', () => {
		expect(FormFieldSchema.safeParse({ type: 'text', pattern: '^[A-Z]{2}\\d{6}$' }).success).toBe(true)
	})

	it('reports a syntax error as invalid syntax, not as ReDoS', () => {
		const result = FormFieldSchema.safeParse({ type: 'uri', pattern: 'a{2,1}' })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toContain('invalid regular expression syntax')
	})
})
