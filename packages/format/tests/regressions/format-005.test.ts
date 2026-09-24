// Regression for audit finding format-005: the README contact and capture examples showed en-US output
// for a de-DE formatter. The README now runs that block through an en-US formatter. Each case checks
// that the README prints the output and that the formatter produces it, so the two cannot drift apart.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createFormatter } from '../../src/index'

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')

describe('format-005', () => {
	const us = createFormatter({ locale: 'en-US' })
	const de = createFormatter({ locale: 'de-DE' })
	const cases: readonly [string, string][] = [
		['phone', us.formatPhone({ number: '+442071838750', extension: '42' })],
		['coordinate', us.formatCoordinate({ lat: 40.7128, lon: -74.006 })],
		['bbox', us.formatBbox({ southWest: { lat: 40.4774, lon: -74.2591 }, northEast: { lat: 40.9176, lon: -73.7004 } })],
		['identification', us.formatIdentification({ type: 'passport', number: 'A1', issueDate: '2020-01-15' })],
		['signature', us.formatSignature({ timestamp: '2026-09-04T15:30:00Z', method: 'drawn' })],
		['de-DE number', de.formatNumber(1234567.89)],
		['de-DE money', de.formatMoney({ amount: 1500.5, currency: 'USD' })],
		['de-DE percentage', de.formatPercentage(8.25)],
		['de-DE boolean', de.formatBoolean(true)],
		['de-DE rating', de.formatRating(4, { max: 5 })],
	]

	it('the README runs the contact and capture block through an en-US formatter', () => {
		expect(readme).toContain("const us = createFormatter({ locale: 'en-US' })")
		expect(us.formatPhone({ number: '+442071838750', extension: '42' })).toBe('+442071838750 ext. 42')
		expect(us.formatSignature({ timestamp: '2026-09-04T15:30:00Z', method: 'drawn' })).toBe('Signature (drawn) on Sep 4, 2026')
	})

	for (const [name, output] of cases) {
		it(`the README shows the real ${name} output`, () => {
			expect(readme).toContain(`// '${output}'`)
		})
	}
})
