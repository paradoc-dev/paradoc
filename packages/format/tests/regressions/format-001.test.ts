// Regression for audit finding format-001: contact messages ignore fallbackLocale.
// Input: createFormatter({ locale: 'es-ES', fallbackLocale: 'en-US' }); safeFormatPhone with extension, safeFormatOrganization with taxId.
// Expected: formatted with en-US package messages (like boolean and duration do).
// Before the fix: status 'unsupported', code 'missing_message' (MissingContactMessageError).
import { describe, expect, it } from 'vitest'
import { createFormatter } from '../../src/index'

describe('format-001', () => {
	const formatter = createFormatter({ locale: 'es-ES', fallbackLocale: 'en-US' })
	it('other families use the fallback (control)', () => {
		expect(formatter.safeFormatBoolean(true)).toMatchObject({ status: 'formatted', value: 'Yes' })
	})
	it('phone extension uses the fallback locale messages', () => {
		expect(formatter.safeFormatPhone({ number: '+34911234567', extension: '12' })).toMatchObject({ status: 'formatted' })
	})
	it('organization labels use the fallback locale messages', () => {
		expect(formatter.safeFormatOrganization({ name: 'A', taxId: 'X' })).toMatchObject({ status: 'formatted' })
	})
})
