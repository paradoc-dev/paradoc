import { describe, expect, it } from 'vitest'

import {
	FormatConfigurationError,
	FormatError,
	createFormatter,
	formatMoney,
	formatNumber,
	formatPercentage,
	safeFormatValue,
} from '../src/index'

describe('@paradoc/format numeric contract', () => {
	it('formats numbers, money, and percentage points in each initial locale', () => {
		const cases = [
			['en-US', '1,234.5', '$1,234.50', '8.25%'],
			['en-GB', '1,234.5', 'US$1,234.50', '8.25%'],
			['de-DE', '1.234,5', '1.234,50 $', '8,25 %'],
			['fr-FR', '1 234,5', '1 234,50 $US', '8,25 %'],
			['ar-SA', '١٬٢٣٤٫٥', '‏١٬٢٣٤٫٥٠ US$', '٨٫٢٥٪؜'],
		] as const

		for (const [locale, number, money, percentage] of cases) {
			const formatter = createFormatter({ locale })
			expect(formatter.formatNumber(1234.5)).toBe(number)
			expect(formatter.formatMoney({ amount: 1234.5, currency: 'USD' })).toBe(money)
			expect(formatter.formatPercentage(8.25)).toBe(percentage)
		}
	})

	it('keeps currency identity and percentage-point semantics explicit', () => {
		expect(formatMoney({ amount: 25, currency: 'EUR' })).toContain('€')
		expect(formatPercentage(8.25)).toBe('8.25%')
		expect(formatPercentage(8.25, { minimumFractionDigits: 3 })).toBe('8.250%')
		expect(() => formatMoney({ amount: 25 })).toThrow(FormatError)
		expect(() => formatMoney(null)).toThrow(FormatError)
	})

	it('distinguishes missing, incomplete, invalid, unsupported, and unexpected results', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatNumber(undefined).status).toBe('missing')
		expect(formatter.safeFormatPercentage(null).status).toBe('missing')
		expect(formatter.safeFormatMoney(null).status).toBe('missing')
		expect(formatter.safeFormatMoney({}).status).toBe('incomplete')
		expect(formatter.safeFormatMoney({ amount: 25 }).status).toBe('incomplete')
		expect(formatter.safeFormatMoney({ amount: '25', currency: undefined }).status).toBe('invalid')
		expect(formatter.safeFormat('date', '2026-01-01')).toMatchObject({ success: true, status: 'formatted', value: 'Jan 1, 2026' })
		expect(formatter.safeFormat('future-kind' as never, 1 as never).status).toBe('unsupported')

		const broken = formatter.withOverrides({
			number: () => 42 as never,
		})
		expect(broken.safeFormatNumber(1).status).toBe('error')
	})

	it('validates delegated values and carries effective locale options through the chain', () => {
		let priorContext: { locale: string; numberingSystem?: string } | undefined
		const formatter = createFormatter({ locale: 'en-US' })
			.withOverrides({
				number: (value, _options, context) => {
					priorContext = { locale: context.locale, numberingSystem: context.options.numberingSystem }
					return context.delegate(value, { maximumFractionDigits: 1 })
				},
			})
			.withOverrides({
				number: (value, _options, context) => context.delegate(value, { signDisplay: 'always' }),
			})

		const result = formatter.safeFormatNumber(12.34, { locale: 'de-DE', numberingSystem: 'latn' })
		expect(result).toMatchObject({ success: true, value: '+12,3' })
		expect(priorContext).toEqual({ locale: 'de-DE', numberingSystem: 'latn' })

		const invalidDelegation = createFormatter().withOverrides({
			number: (value, _options, context) => context.delegate(Number.NaN),
		})
		expect(invalidDelegation.safeFormatNumber(1).status).toBe('invalid')
	})

	it('rejects invalid per-kind Intl defaults during construction', () => {
		expect(() => createFormatter({ number: { minimumFractionDigits: 4, maximumFractionDigits: 2 } })).toThrow(FormatConfigurationError)
		expect(() => createFormatter({ money: { minimumFractionDigits: 4, maximumFractionDigits: 2 } })).toThrow(FormatConfigurationError)
		expect(() => createFormatter({ percentage: { minimumFractionDigits: 4, maximumFractionDigits: 2 } })).toThrow(FormatConfigurationError)
	})

	it('preserves invalid supplied members when another money member is absent', () => {
		const result = createFormatter().safeFormatMoney({ amount: 'not-a-number' })
		expect(result.status).toBe('invalid')
		if (result.status === 'invalid') {
			expect(result.issues.map((item) => item.path)).toEqual(['amount', 'currency'])
		}
	})

	it('supports Arabic digit overrides independent of locale', () => {
		const formatter = createFormatter({ locale: 'ar-SA' })
		expect(formatter.formatNumber(1234.5)).toContain('١')
		expect(formatter.formatNumber(1234.5, { numberingSystem: 'latn' })).toBe('1,234.5')
	})

	it('composes immutable configuration and delegates overrides without recursion', () => {
		const base = createFormatter({ locale: 'en-US' })
		const composed = base
			.compose({ number: { maximumFractionDigits: 0 } })
			.withOverrides({
				number: (value, options, context) => context.delegate(value, { ...options, signDisplay: 'always' }),
			})

		expect(base.formatNumber(12.4)).toBe('12.4')
		expect(composed.formatNumber(12.4)).toBe('+12')

		const sibling = base.compose({ locale: 'de-DE' })
		expect(base.formatNumber(12.4)).toBe('12.4')
		expect(sibling.formatNumber(12.4)).toBe('12,4')
	})

	it('supports amount-only output and isolates money options from number options', () => {
		const formatter = createFormatter({ locale: 'en-US' })
		const amountOnly = formatter.compose({ money: { currencyDisplay: 'none', minimumFractionDigits: 2 } })
		expect(amountOnly.formatMoney({ amount: 12.5, currency: 'USD' })).toBe('12.50')
		expect(formatter.formatMoney({ amount: 12.5, currency: 'USD' })).toBe('$12.50')
		expect(amountOnly.formatNumber(12.5)).toBe('12.5')
	})

	it('reuses same-policy Intl instances while keeping cache size bounded', () => {
		const formatter = createFormatter({ cacheSize: 2 })
		formatter.formatNumber(1.25)
		formatter.formatNumber(1.25)
		formatter.formatMoney({ amount: 1, currency: 'USD' })
		formatter.formatMoney({ amount: 1, currency: 'USD' })
		const stats = formatter.cacheStats()
		expect(stats.number.hits).toBe(1)
		expect(stats.money.hits).toBe(1)
		expect(stats.number.size).toBeLessThanOrEqual(2)
		expect(stats.money.size).toBeLessThanOrEqual(2)
	})

	it('exposes dynamic and safe standalone calls', () => {
		expect(formatNumber(1234.5)).toBe('1,234.5')
		expect(safeFormatValue('percentage', 8.25)).toMatchObject({ success: true, status: 'formatted', value: '8.25%' })
	})
})
