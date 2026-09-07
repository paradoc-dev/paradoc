import { describe, expect, it } from 'vitest'

import {
	FormatConfigurationError,
	createFormatter,
	formatDate,
	formatDatetime,
	formatDuration,
	formatTime,
	safeFormatValue,
} from '../src/index'

describe('@paradoc/format temporal values', () => {
	it('formats the four temporal families through direct and dynamic operations', () => {
		const formatter = createFormatter({ locale: 'en-US' })

		expect(formatter.formatDate('2026-09-04')).toBe('Sep 4, 2026')
		expect(formatter.formatDatetime('2026-09-04T15:30:00Z')).toBe('Sep 4, 2026, 3:30 PM')
		expect(formatter.formatTime('15:30:00')).toBe('3:30 PM')
		expect(formatter.formatDuration('P1Y2M3DT4H5M6S')).toBe('1 year, 2 months, 3 days, 4 hours, 5 minutes, 6 seconds')
		expect(formatDate('2026-09-04')).toBe('Sep 4, 2026')
		expect(formatDatetime('2026-09-04T15:30:00Z')).toBe('Sep 4, 2026, 3:30 PM')
		expect(formatTime('15:30:00')).toBe('3:30 PM')
		expect(formatDuration('PT1.5S')).toBe('1.5 seconds')
		expect(safeFormatValue('date', '2026-09-04')).toMatchObject({ success: true, status: 'formatted' })
	})

	it('localizes temporal output in the initial locales', () => {
		const expected = [
			['en-US', 'Sep 4, 2026', '3:30 PM', '1 year, 2 months'],
			['en-GB', '4 Sept 2026', '15:30', '1 year, 2 months'],
			['de-DE', '4. Sept. 2026', '15:30', '1 Jahr, 2 Monate'],
			['fr-FR', '4 sept. 2026', '15:30', '1 an, 2 mois'],
			['ar-SA', '٤ سبتمبر ٢٠٢٦', '٣:٣٠ م', '١ سنة, ٢ شهران'],
		] as const

		for (const [locale, date, time, duration] of expected) {
			const formatter = createFormatter({ locale })
			expect(formatter.formatDate('2026-09-04')).toBe(date)
			expect(formatter.formatTime('15:30')).toBe(time)
			expect(formatter.formatDuration('P1Y2M')).toBe(duration)
		}
	})

	it('keeps calendar dates and local clock values stable while converting instants', () => {
		const formatter = createFormatter({ locale: 'en-US', timeZone: 'America/New_York' })

		expect(formatter.formatDate('2026-09-05')).toBe('Sep 5, 2026')
		expect(formatter.formatDate(new Date('2026-09-05T01:00:00Z'))).toBe('Sep 4, 2026')
		expect(formatter.formatDatetime('2026-09-05T01:00:00')).toBe('Sep 5, 2026, 1:00 AM')
		expect(formatter.formatDatetime('2026-09-05T01:00:00Z')).toBe('Sep 4, 2026, 9:00 PM')
		expect(formatter.formatDatetime('2026-09-05T01:00:00+03:00')).toBe('Sep 4, 2026, 6:00 PM')
	})

	it('supports explicit calendars and numbering systems independently', () => {
		const formatter = createFormatter({ locale: 'ar-SA', calendar: 'islamic', numberingSystem: 'latn' })
		expect(formatter.formatDate('2026-09-04')).toBe('23 ربيع الأول 1448 هـ')
		expect(formatter.formatTime('15:30')).toBe('3:30 م')
		expect(formatter.formatDate('2026-09-04', { calendar: 'gregory', numberingSystem: 'arab' })).toBe('٤ سبتمبر ٢٠٢٦')
	})

	it('supports early years and rejects malformed calendar values and offsets', () => {
		const formatter = createFormatter()
		expect(formatter.formatDate('0099-01-02')).toBe('Jan 2, 99')
		expect(formatter.safeFormatDate('2026-02-29')).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatDatetime('2026-01-01T12:00:00+25:00')).toMatchObject({ success: false, status: 'invalid' })
		expect(() => createFormatter({ calendar: 'not-a-calendar' })).toThrow(FormatConfigurationError)
		expect(formatter.safeFormatDate('2026-01-01', { calendar: 'not-a-calendar' })).toMatchObject({ success: false, status: 'unsupported' })
	})

	it('distinguishes missing and invalid temporal input and validates duration syntax', () => {
		const formatter = createFormatter()
		expect(formatter.safeFormatDate(undefined)).toMatchObject({ success: false, status: 'missing' })
		expect(formatter.safeFormatTime('25:00')).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatDuration('P')).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.formatDuration('PT0S')).toBe('0 seconds')
		expect(formatter.formatDuration('PT1.234567S')).toBe('1.234567 seconds')
	})

	it('allows caller messages for runtime-supported locales and reports missing resources', () => {
		const missing = createFormatter({ locale: 'es-ES' }).safeFormatDuration('P1D')
		expect(missing).toMatchObject({ success: false, status: 'unsupported' })

		const formatter = createFormatter({
			locale: 'es-ES',
			messages: {
				'es-ES': {
					'duration.day.one': '{value} día',
					'duration.day.other': '{value} días',
				},
			},
		})
		expect(formatter.formatDuration('P2D')).toBe('2 días')
	})

	it('composes temporal overrides through the shared formatter contract', () => {
		const base = createFormatter()
		const custom = base.withOverrides({
			date: (value, options, context) => `[${context.delegate(value, options)}]`,
		})

		expect(custom.formatDate('2026-09-04')).toBe('[Sep 4, 2026]')
		expect(base.formatDate('2026-09-04')).toBe('Sep 4, 2026')
	})
})
