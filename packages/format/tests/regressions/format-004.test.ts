// Regression for audit finding format-004: the same bad option is 'invalid' for numbers but 'unsupported' for coordinates, bad locales, bad time zones.
// Input: safeFormatNumber(1, { maximumFractionDigits: 200 }) -> invalid (control)
//   safeFormatCoordinate({ lat: 1, lon: 2 }, { maximumFractionDigits: 200 }) -> expected invalid, actual unsupported/unsupported_configuration
//   safeFormatNumber(1, { locale: '!!' }) -> expected invalid, actual unsupported
//   safeFormatDate('2026-01-01T00:00:00Z', { timeZone: 'Nope/Zone' }) -> expected invalid, actual unsupported
import { describe, expect, it } from 'vitest'
import { createFormatter } from '../../src/index'

describe('format-004', () => {
	const formatter = createFormatter()
	it('control: number option out of range is invalid', () => {
		expect(formatter.safeFormatNumber(1, { maximumFractionDigits: 200 } as never)).toMatchObject({ status: 'invalid' })
	})
	it('coordinate option out of range is invalid', () => {
		expect(formatter.safeFormatCoordinate({ lat: 1, lon: 2 }, { maximumFractionDigits: 200 } as never)).toMatchObject({ status: 'invalid' })
	})
	it('malformed per-call locale is invalid', () => {
		expect(formatter.safeFormatNumber(1, { locale: '!!' } as never)).toMatchObject({ status: 'invalid' })
	})
	it('mistyped timeZone is invalid', () => {
		expect(formatter.safeFormatDate('2026-01-01T00:00:00Z', { timeZone: 'Nope/Zone' } as never)).toMatchObject({ status: 'invalid' })
	})
})
