/**
 * schemas-004: `.default(x).optional()` injects defaults into parsed artifacts.
 * Input: { kind:'form', name:'x', parties:{ buyer:{ label:'B', signature:{} } }, rules:{ r1:{ expr:'true', message:'m' } } }
 * Expected: parse output equals the input (no keys the author did not write).
 * Actual: adds allowAdditionalAnnexes:false, partyType:'any', min:1, max:1,
 *         signature {required:false,witnesses:0,notarized:false}, severity:'error'.
 *         Core form(...).toJSON() writes the same keys back (checked with core dist).
 */
import { describe, expect, it } from 'vitest'
import { FormSchema } from '../src/zod'

describe('schemas-004', () => {
	it('does not add default values to a parsed form', () => {
		const input = {
			kind: 'form',
			name: 'x',
			parties: { buyer: { label: 'B', signature: {} } },
			rules: { r1: { expr: 'true', message: 'm' } },
		}
		expect(FormSchema.parse(input)).toEqual(input)
	})
})
