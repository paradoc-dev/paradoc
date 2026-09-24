// Regression for audit finding format-003: party identity inference counts keys whose value is undefined.
// Input: safeFormatParty({ name: 'Jane', taxId: undefined })
//   Expected: invalid/ambiguous_identity (only 'name' is set, as with { name: 'Jane' }). Before the fix: formatted as an organization.
// Input: safeFormatParty({ firstName: 'Jane', lastName: 'Doe', taxId: undefined })
//   Expected: formatted as a person. Before the fix: invalid/ambiguous_identity.
import { describe, expect, it } from 'vitest'
import { createFormatter } from '../../src/index'

describe('format-003', () => {
	const formatter = createFormatter()
	it('undefined org member does not make a name-only party an organization', () => {
		const baseline = formatter.safeFormatParty({ name: 'Jane' })
		expect(formatter.safeFormatParty({ name: 'Jane', taxId: undefined } as never)).toEqual(baseline)
	})
	it('undefined org member does not make a person party ambiguous', () => {
		expect(formatter.safeFormatParty({ firstName: 'Jane', lastName: 'Doe', taxId: undefined } as never)).toMatchObject({ status: 'formatted', value: 'Jane Doe' })
	})
})
