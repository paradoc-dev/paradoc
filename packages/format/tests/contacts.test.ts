import { describe, expect, it } from 'vitest'

import {
	FormatConfigurationError,
	createFormatter,
	formatValue,
	safeFormatValue,
} from '../src/index'

const person = {
	firstName: 'Jane',
	lastName: 'Smith',
}

const organization = {
	name: 'Acme Corp',
	legalName: 'Acme Corporation Ltd.',
	taxId: 'GB-123',
}

const address = {
	line1: '10 Downing Street',
	line2: 'Flat 4',
	locality: 'London',
	region: 'Greater London',
	postalCode: 'SW1A 2AA',
	country: 'GB',
}

describe('@paradoc/format contact values', () => {
	it('formats people, organizations, phones, and parties through the common API', () => {
		const formatter = createFormatter({ locale: 'en-GB' })

		expect(formatter.formatPerson(person)).toBe('Jane Smith')
		expect(formatter.formatOrganization(organization)).toContain('Acme Corp')
		expect(formatter.formatOrganization(organization)).toContain('Tax ID: GB-123')
		expect(formatter.formatPhone({ number: '+442071838750', extension: '42' })).toBe('+442071838750 ext. 42')
		expect(formatter.formatParty(person)).toBe('Jane Smith')
		expect(formatter.formatParty(organization)).toContain('Acme Corp')
		expect(formatValue('phone', '+442071838750')).toBe('+442071838750')
	})

	it('rejects malformed person names and non-canonical or overlong phones', () => {
		const formatter = createFormatter()

		expect(formatter.safeFormatPerson({ name: 123 })).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatPhone('+1212')).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatPhone('+1234567890123456')).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatPhone({ number: '+12125551234', extension: '' })).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.formatPhone({ number: '+12125551234', extension: 'desk' })).toBe('+12125551234 ext. desk')
	})

	it('diagnoses an ambiguous party instead of treating a shared name as a business', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatParty({ name: 'Shared Name' })).toMatchObject({ success: false, status: 'invalid' })
		const mixed = { name: 'Jane', firstName: 'Jane', lastName: 'Smith', legalName: 'Acme' }
		const result = formatter.safeFormatParty(mixed)
		expect(result).toMatchObject({ success: false, status: 'invalid' })
		if (!result.success) {
			expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ambiguous_identity' })]))
		}
		expect(formatter.formatParty(mixed, { partyType: 'person' })).toBe('Jane')
		expect(formatter.formatParty(mixed, { partyType: 'organization' })).toBe('Jane (Legal name: Acme)')
		expect(formatter.formatParty({ name: 'Jane Smith' }, { partyType: 'person' })).toBe('Jane Smith')
	})

	it('keeps address country layouts independent from the document locale', () => {
		const formatter = createFormatter({ locale: 'fr-FR' })
		const cases = [
			['US', 'New York', '10001'],
			['GB', 'London', 'SW1A 2AA'],
			['DE', 'Berlin', '10115'],
			['FR', 'Paris', '75001'],
			['SA', 'Riyadh', '12345'],
		] as const

		for (const [country, locality, postalCode] of cases) {
			const result = formatter.formatAddress({ ...address, country, locality, postalCode })
			expect(result).toContain(country)
			expect(result).toContain(locality)
		}
	})

	it('distinguishes strict unsupported address layouts from explicit generic layout', () => {
		const formatter = createFormatter()
		const unknown = { ...address, country: 'CA' }

		expect(formatter.safeFormatAddress(unknown)).toMatchObject({ success: false, status: 'unsupported' })
		expect(formatter.safeFormatAddress(unknown, { layout: 'generic' })).toMatchObject({
			success: true,
			status: 'formatted',
			value: '10 Downing Street, Flat 4, London, Greater London, SW1A 2AA, CA',
		})
		const malformed = formatter.safeFormatAddress({ ...unknown, country: 'X' }, { layout: 'generic' })
		expect(malformed).toMatchObject({ success: false, status: 'invalid' })
		if (!malformed.success) {
			expect(malformed.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid_member', path: 'country' })]))
		}

		const custom = createFormatter({
			address: {
				countryLayouts: {
					CA: (value) => `${value.postalCode} ${value.locality}, ${value.line1}, ${value.country}`,
				},
			},
		})
		expect(custom.formatAddress(unknown)).toBe('SW1A 2AA London, 10 Downing Street, CA')
	})

	it('uses caller messages for an additional runtime locale', () => {
		const formatter = createFormatter({
			locale: 'es-ES',
			messages: {
				'es-ES': {
					'phone.extension': 'extensión',
					'organization.legalName': 'Nombre legal',
					'organization.taxId': 'NIF',
				},
			},
		})

		expect(formatter.formatPhone({ number: '+34911234567', extension: '9' })).toBe('+34911234567 extensión 9')
		expect(formatter.formatOrganization({ name: 'Acme', legalName: 'Acme S.L.', taxId: 'X1' })).toBe('Acme (Nombre legal: Acme S.L., NIF: X1)')
		expect(createFormatter({ locale: 'es-ES' }).safeFormatPhone({ number: '+34911234567', extension: '9' })).toMatchObject({
			success: false,
			status: 'unsupported',
		})
	})

	it('preserves a phone type for custom implementations', () => {
		const formatter = createFormatter({
			overrides: {
				phone: (value) => {
					if (typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string') return value.type
					return 'missing type'
				},
			},
		})

		expect(formatter.formatPhone({ number: '+12125551234', type: 'mobile' })).toBe('mobile')
	})

	it('composes person overrides through parties without mutating siblings', () => {
		const base = createFormatter()
		const custom = base.withOverrides({
			person: (value, options, context) => `[${context.delegate(value, options)}]`,
		})
		const sibling = base.compose({ locale: 'de-DE' })

		expect(custom.formatPerson(person)).toBe('[Jane Smith]')
		expect(custom.formatParty(person)).toBe('[Jane Smith]')
		expect(base.formatPerson(person)).toBe('Jane Smith')
		expect(sibling.formatPerson(person)).toBe('Jane Smith')
		expect(safeFormatValue('person', person)).toMatchObject({ success: true, value: 'Jane Smith' })
	})
})

describe('@paradoc/format contact messages and option guards', () => {
	const phone = { number: '+34911234567', extension: '12' }
	const organization = { name: 'Acme', legalName: 'Acme GmbH', taxId: 'X1' }

	it('reads contact messages from the fallback locale when the requested locale has none', () => {
		const formatter = createFormatter({ locale: 'es-ES', fallbackLocale: 'en-US' })
		expect(formatter.formatPhone(phone)).toBe('+34911234567 ext. 12')
		expect(formatter.formatOrganization(organization)).toBe('Acme (Legal name: Acme GmbH, Tax ID: X1)')
		expect(formatter.formatParty({ name: 'Acme', taxId: 'X1' })).toBe('Acme (Tax ID: X1)')

		const withoutFallback = createFormatter({ locale: 'es-ES' })
		expect(withoutFallback.safeFormatPhone(phone)).toMatchObject({ status: 'unsupported', issues: [expect.objectContaining({ code: 'missing_message', kind: 'phone' })] })
		expect(withoutFallback.safeFormatOrganization(organization)).toMatchObject({ status: 'unsupported', issues: [expect.objectContaining({ code: 'missing_message' })] })
	})

	it('reads the messages of a locale that shares the language when the region has none', () => {
		const formatter = createFormatter({ locale: 'de-AT' })
		expect(formatter.formatPhone({ number: '+43123456789', extension: '12' })).toBe('+43123456789 Durchwahl 12')
		expect(formatter.formatOrganization({ name: 'Acme', taxId: 'X1' })).toBe('Acme (Steuer-ID: X1)')
		expect(createFormatter({ locale: 'fr-CA' }).formatPhone({ number: '+15145550100', extension: '7' })).toBe('+15145550100 poste 7')
	})

	it('infers a party identity only from members that carry a value', () => {
		const formatter = createFormatter()
		expect(formatter.formatParty({ firstName: 'Jane', lastName: 'Doe', taxId: undefined } as never)).toBe('Jane Doe')
		expect(formatter.formatParty({ name: 'Acme', taxId: 'X1', firstName: null } as never)).toBe('Acme (Tax ID: X1)')
		expect(formatter.safeFormatParty({ name: 'Jane', legalName: undefined } as never)).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'ambiguous_identity' })],
		})
	})

	it('refuses address, phone, and party options it cannot act on, at construction and per call', () => {
		const formatter = createFormatter()
		const address = { line1: '1 Main St', locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'US' }
		const badAddressOptions = [
			{ layout: 'vertical' as never },
			{ countryLayouts: { USA: () => 'x' } },
			{ countryLayouts: { US: 'x' as never } },
		]
		for (const options of badAddressOptions) {
			expect(() => createFormatter({ address: options })).toThrow(FormatConfigurationError)
			expect(formatter.safeFormatAddress(address, options)).toMatchObject({
				status: 'invalid',
				issues: [expect.objectContaining({ code: 'invalid_options', kind: 'address' })],
			})
		}

		for (const extensionLabel of ['', '   ']) {
			expect(() => createFormatter({ phone: { extensionLabel } })).toThrow(/extensionLabel/)
			expect(formatter.safeFormatPhone(phone, { extensionLabel })).toMatchObject({
				status: 'invalid',
				issues: [expect.objectContaining({ code: 'invalid_options', kind: 'phone' })],
			})
		}
		expect(formatter.formatPhone(phone, { extensionLabel: 'x' })).toBe('+34911234567 x 12')

		expect(() => createFormatter({ party: { partyType: 'robot' as never } })).toThrow(/partyType/)
		expect(formatter.safeFormatParty({ name: 'Acme' }, { partyType: 'robot' as never })).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'invalid_options', kind: 'party' })],
		})
		expect(formatter.formatParty({ name: 'Acme' }, { partyType: 'organization' })).toBe('Acme')
	})
})

describe('@paradoc/format address layouts', () => {
	const address = { line1: '1 Main', locality: 'Town', region: 'CA', postalCode: '12345', country: 'US' }
	const french = { ...address, country: 'FR' }
	const formatter = createFormatter({ address: { countryLayouts: { US: () => 'CONFIG-US' } } })

	it('adds call layouts to the configured ones', () => {
		const options = { countryLayouts: { FR: () => 'CALL-FR' } }
		expect(formatter.formatAddress(address, options)).toBe('CONFIG-US')
		expect(formatter.formatAddress(french, options)).toBe('CALL-FR')
		expect(formatter.formatAddress(french)).toBe('1 Main, 12345 Town, CA, FR')
	})

	it('keeps the configured layouts when an override delegates with more', () => {
		const delegating = formatter.withOverrides({
			address: (value, _options, context) => context.delegate(value, { countryLayouts: { FR: () => 'DELEGATE-FR' } }),
		})
		expect(delegating.formatAddress(address)).toBe('CONFIG-US')
		expect(delegating.formatAddress(french)).toBe('DELEGATE-FR')
	})
})
