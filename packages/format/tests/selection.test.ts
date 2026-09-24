import { describe, expect, it, vi } from 'vitest'

import {
	createFormatter,
	formatBoolean,
	formatEnum,
	formatMultiselect,
	formatRating,
	safeFormatValue,
} from '../src/index'

const options = [
	{ value: 'plumbing', label: 'Plumbing' },
	{ value: 'wiring', label: 'Wiring' },
	{ value: 'roofing', label: 'Roofing' },
]

describe('@paradoc/format selection values', () => {
	it('formats every selection kind through direct, dynamic, and standalone operations', () => {
		const formatter = createFormatter()

		expect(formatter.formatBoolean(true)).toBe('Yes')
		expect(formatter.formatEnum('wiring', { options })).toBe('Wiring')
		expect(formatter.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('Plumbing and Wiring')
		expect(formatter.formatRating(4, { max: 5 })).toBe('4 of 5')

		expect(formatter.format('boolean', false)).toBe('No')
		expect(formatter.format('enum', 'roofing', { options })).toBe('Roofing')
		expect(formatter.format('multiselect', ['plumbing'], { options })).toBe('Plumbing')
		expect(formatter.format('rating', 2, { max: 10 })).toBe('2 of 10')

		expect(formatBoolean(true)).toBe('Yes')
		expect(formatEnum('wiring', { options })).toBe('Wiring')
		expect(formatMultiselect(['wiring', 'roofing'], { options })).toBe('Wiring and Roofing')
		expect(formatRating(1, { max: 5 })).toBe('1 of 5')
		expect(safeFormatValue('rating', 3, { max: 5 })).toEqual({ success: true, status: 'formatted', value: '3 of 5' })
	})

	it('keeps the locale words for true and false in every initial locale', () => {
		const words = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ar-SA'].map((locale) => {
			const formatter = createFormatter({ locale })
			return [formatter.formatBoolean(true), formatter.formatBoolean(false)]
		})
		expect(words).toEqual([
			['Yes', 'No'],
			['Yes', 'No'],
			['Ja', 'Nein'],
			['Oui', 'Non'],
			['نعم', 'لا'],
		])
	})

	it('lets a caller replace the boolean words without changing the locale', () => {
		const formatter = createFormatter({ locale: 'de-DE', boolean: { trueLabel: 'Aktiv', falseLabel: 'Inaktiv' } })
		expect(formatter.formatBoolean(true)).toBe('Aktiv')
		expect(formatter.formatBoolean(false)).toBe('Inaktiv')
		expect(formatter.formatBoolean(true, { trueLabel: 'Ja, doch' })).toBe('Ja, doch')
		expect(createFormatter({ locale: 'de-DE' }).formatBoolean(true)).toBe('Ja')
	})

	it('presents an enum with its declared label, or its own value when the option carries none', () => {
		const formatter = createFormatter()
		expect(formatter.formatEnum('plumbing', { options })).toBe('Plumbing')
		expect(formatter.formatEnum('plumbing', { options: [{ value: 'plumbing' }] })).toBe('plumbing')
		expect(formatter.formatEnum(2, { options: [{ value: 2, label: 'Two' }] })).toBe('Two')
	})

	it('refuses a value no option declares, unless the caller chose to print it', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatEnum('painting', { options })).toEqual({
			success: false,
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'unknown_option', kind: 'enum' })],
		})
		expect(() => formatter.formatEnum('painting', { options })).toThrowError(/painting/)
		expect(formatter.formatEnum('painting', { options, unknownOption: 'value' })).toBe('painting')
		expect(formatter.safeFormatMultiselect(['plumbing', 'painting'], { options })).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'unknown_option', kind: 'multiselect' })],
		})
	})

	it("joins a multiselect with each locale's own conjunction and separator", () => {
		const selected = ['plumbing', 'wiring', 'roofing']
		expect(createFormatter().formatMultiselect(selected, { options })).toBe('Plumbing, Wiring, and Roofing')
		expect(createFormatter({ locale: 'de-DE' }).formatMultiselect(selected, { options })).toBe('Plumbing, Wiring und Roofing')
		expect(createFormatter({ locale: 'fr-FR' }).formatMultiselect(selected, { options })).toBe('Plumbing, Wiring et Roofing')
	})

	it('keeps an Arabic join reading right to left', () => {
		const arabicOptions = [
			{ value: 'plumbing', label: 'سباكة' },
			{ value: 'wiring', label: 'كهرباء' },
		]
		const joined = createFormatter({ locale: 'ar-SA' }).formatMultiselect(['plumbing', 'wiring'], { options: arabicOptions })

		expect(joined).toBe('سباكة وكهرباء')
		// The first strong character decides the run's direction: it must stay Arabic,
		// and no left-to-right mark may be inserted ahead of it.
		expect(/^[؀-ۿ]/.test(joined)).toBe(true)
		expect(joined).not.toMatch(/[‎‪‭]/)
		expect(joined.indexOf('سباكة')).toBeLessThan(joined.indexOf('كهرباء'))
	})

	it('takes the list relation and verbosity from the caller', () => {
		const formatter = createFormatter()
		const selected = ['plumbing', 'wiring']
		expect(formatter.formatMultiselect(selected, { options, listType: 'disjunction' })).toBe('Plumbing or Wiring')
		expect(formatter.formatMultiselect(selected, { options, listType: 'unit', listStyle: 'narrow' })).toBe('Plumbing Wiring')
	})

	it('prints a rating with the scale it was given on, in the locale', () => {
		expect(createFormatter().formatRating(4, { max: 5 })).toBe('4 of 5')
		expect(createFormatter({ locale: 'de-DE' }).formatRating(4, { max: 5 })).toBe('4 von 5')
		expect(createFormatter({ locale: 'fr-FR' }).formatRating(4, { max: 5 })).toBe('4 sur 5')
		expect(createFormatter({ locale: 'ar-SA' }).formatRating(4, { max: 5 })).toBe('٤ من ٥')
		expect(createFormatter({ locale: 'ar-SA', numberingSystem: 'latn' }).formatRating(4, { max: 5 })).toBe('4 من 5')
		// A per-call numbering system specializes the formatter without mutating it.
		const arabic = createFormatter({ locale: 'ar-SA' })
		expect(arabic.formatRating(4, { max: 5, numberingSystem: 'latn' })).toBe('4 من 5')
		expect(arabic.formatRating(4, { max: 5 })).toBe('٤ من ٥')
		expect(createFormatter().formatRating(4, { max: 5, locale: 'de-DE' })).toBe('4 von 5')
		expect(createFormatter().formatRating(4, { max: 5, display: 'value' })).toBe('4')
	})

	it('returns a structured unsupported outcome for a rating with no scale', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatRating(4)).toEqual({
			success: false,
			status: 'unsupported',
			issues: [expect.objectContaining({ code: 'missing_scale', kind: 'rating' })],
		})
		expect(() => formatter.formatRating(4)).toThrowError(/no maximum/)
	})

	it('returns a structured unsupported outcome when the runtime carries no list conjunction', () => {
		const formatter = createFormatter()
		const supported = vi.spyOn(Intl.ListFormat, 'supportedLocalesOf').mockReturnValue([])
		try {
			expect(formatter.safeFormatMultiselect(['plumbing', 'wiring'], { options })).toEqual({
				success: false,
				status: 'unsupported',
				issues: [expect.objectContaining({ code: 'unsupported_list', kind: 'multiselect' })],
			})
		} finally {
			supported.mockRestore()
		}
		expect(formatter.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('Plumbing and Wiring')
	})

	it('distinguishes missing values from malformed ones', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatBoolean(undefined)).toMatchObject({ status: 'missing' })
		expect(formatter.safeFormatEnum(null, { options })).toMatchObject({ status: 'missing' })
		expect(formatter.safeFormatMultiselect(undefined, { options })).toMatchObject({ status: 'missing' })
		expect(formatter.safeFormatRating(null)).toMatchObject({ status: 'missing' })

		expect(formatter.safeFormatBoolean('yes' as never)).toMatchObject({ status: 'invalid' })
		expect(formatter.safeFormatEnum({} as never, { options })).toMatchObject({ status: 'invalid' })
		expect(formatter.safeFormatMultiselect('plumbing' as never, { options })).toMatchObject({ status: 'invalid' })
		expect(formatter.safeFormatMultiselect([{}] as never, { options })).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'invalid_member', path: '[0]' })],
		})
		expect(formatter.safeFormatRating(Number.NaN)).toMatchObject({ status: 'invalid' })
		// False and zero are values, not absences.
		expect(formatter.formatBoolean(false)).toBe('No')
		expect(formatter.formatRating(0, { max: 5 })).toBe('0 of 5')
	})

	it('resolves a multiselect through the effective enum formatter', () => {
		const shouting = createFormatter().withOverrides({
			enum: (value, callOptions, context) => context.delegate(value, callOptions).toUpperCase(),
		})
		// One override, every path that presents an option label.
		expect(shouting.formatEnum('plumbing', { options })).toBe('PLUMBING')
		expect(shouting.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('PLUMBING and WIRING')
		expect(createFormatter().formatMultiselect(['plumbing', 'wiring'], { options })).toBe('Plumbing and Wiring')
	})

	it('overrides and delegates every selection kind', () => {
		const formatter = createFormatter().withOverrides({
			boolean: (value, callOptions, context) => `[${context.delegate(value, callOptions)}]`,
			enum: (value, callOptions, context) => `<${context.delegate(value, callOptions)}>`,
			rating: (value, callOptions, context) => `${context.delegate(value, callOptions)}!`,
		})
		expect(formatter.formatBoolean(true)).toBe('[Yes]')
		expect(formatter.formatEnum('wiring', { options })).toBe('<Wiring>')
		expect(formatter.formatRating(4, { max: 5 })).toBe('4 of 5!')
		// An override may specialize the options it delegates with.
		expect(createFormatter().withOverrides({
			rating: (value, callOptions, context) => context.delegate(value, { ...callOptions, display: 'value' }),
		}).formatRating(4, { max: 5 })).toBe('4')
	})

	it('composes and overrides a selection kind without touching its base formatter', () => {
		const base = createFormatter()
		const shouted = base.withOverrides({
			multiselect: (value, callOptions, context) => context.delegate(value, callOptions).toUpperCase(),
		})
		expect(shouted.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('PLUMBING AND WIRING')
		expect(base.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('Plumbing and Wiring')

		const german = shouted.compose({ locale: 'de-DE' })
		expect(german.formatMultiselect(['plumbing', 'wiring'], { options })).toBe('PLUMBING UND WIRING')
		expect(german.formatBoolean(true)).toBe('Ja')
		expect(base.locale).toBe('en-US')
	})

	it('refuses selection configuration it cannot act on', () => {
		expect(() => createFormatter({ multiselect: { listType: 'sentence' as never } })).toThrowError(/listType/)
		expect(() => createFormatter({ multiselect: { listStyle: 'tiny' as never } })).toThrowError(/listStyle/)
		expect(() => createFormatter({ rating: { max: Number.POSITIVE_INFINITY } })).toThrowError(/max/)
		expect(() => createFormatter({ rating: { display: 'stars' as never } })).toThrowError(/display/)
		expect(() => createFormatter({ enum: { unknownOption: 'guess' as never } })).toThrowError(/unknownOption/)
		expect(() => createFormatter({ enum: { options: [{ label: 'No value' } as never] } })).toThrowError(/option/)
		expect(createFormatter().safeFormatRating(4, { max: 'five' as never })).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'invalid_options', kind: 'rating' })],
		})
	})

	it('names a locale with no selection messages instead of leaking English', () => {
		const formatter = createFormatter({ locale: 'ja-JP' })
		expect(formatter.safeFormatBoolean(true)).toEqual({
			success: false,
			status: 'unsupported',
			issues: [expect.objectContaining({ code: 'missing_message', kind: 'boolean' })],
		})
		expect(createFormatter({ locale: 'ja-JP', messages: { 'ja-JP': { 'boolean.true': 'はい', 'boolean.false': 'いいえ' } } }).formatBoolean(true)).toBe('はい')
		expect(createFormatter({ locale: 'ja-JP', fallbackLocale: 'en-US' }).formatBoolean(true)).toBe('Yes')
	})
})

describe('@paradoc/format selection messages and nested options', () => {
	it('reads the messages of a locale that shares the language when the region has none', () => {
		const formatter = createFormatter({ locale: 'de-AT' })
		expect(formatter.formatBoolean(true)).toBe('Ja')
		expect(formatter.formatRating(4, { max: 5 })).toBe('4 von 5')
	})

	it('formats a rating number and multiselect labels with their own options alone', () => {
		const formatter = createFormatter({
			number: { maximumFractionDigits: 0 },
			enum: { options: [{ value: 'a', label: 'Enum A' }] },
		})
		expect(formatter.formatRating(4.5, { max: 5 })).toBe('4.5 of 5')
		expect(formatter.formatNumber(4.5)).toBe('5')
		expect(formatter.formatMultiselect(['a'], { options: [{ value: 'a', label: 'Multi A' }] })).toBe('Multi A')
		expect(formatter.safeFormatMultiselect(['a'])).toMatchObject({
			status: 'invalid',
			issues: [expect.objectContaining({ code: 'unknown_option' })],
		})
		expect(formatter.formatEnum('a')).toBe('Enum A')
	})
})
