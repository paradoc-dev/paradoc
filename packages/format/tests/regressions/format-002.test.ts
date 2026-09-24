// Regression for audit finding format-002: nested formatting inherits the sibling kind's formatter-level options.
// Input A: createFormatter({ date: { dateStyle: 'long' }, signature: { month: 'long', day: 'numeric', year: 'numeric' } }) then safeFormatSignature(...)
//   Expected: the signature formats. Before the fix: constructs, then every call is invalid/invalid_options with kind 'date'.
// Input B: createFormatter({ number: { maximumFractionDigits: 0 } }).formatRating(4.5, { max: 5 })
//   Expected: '4.5 of 5'. Before the fix: '5 of 5'.
import { describe, expect, it } from 'vitest'
import { createFormatter } from '../../src/index'

describe('format-002', () => {
	it('signature options do not mix with formatter-level date options', () => {
		const formatter = createFormatter({ date: { dateStyle: 'long' }, signature: { month: 'long', day: 'numeric', year: 'numeric' } } as never)
		expect(formatter.safeFormatSignature({ timestamp: '2026-09-04T15:30:00Z', method: 'drawn' })).toMatchObject({ status: 'formatted' })
	})
	it('identification options do not mix with formatter-level date options', () => {
		const formatter = createFormatter({ date: { dateStyle: 'long' }, identification: { month: 'long', day: 'numeric', year: 'numeric' } } as never)
		expect(formatter.safeFormatIdentification({ type: 'passport', number: 'A1', issueDate: '2020-01-15' })).toMatchObject({ status: 'formatted' })
	})
	it('rating value is not rounded by formatter-level number options', () => {
		expect(createFormatter({ number: { maximumFractionDigits: 0 } }).formatRating(4.5, { max: 5 })).toBe('4.5 of 5')
	})
})
