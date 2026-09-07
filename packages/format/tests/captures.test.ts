import { describe, expect, it } from 'vitest'

import {
	createFormatter,
	formatAttachment,
	formatBbox,
	formatCoordinate,
	formatIdentification,
	formatSignature,
	safeFormatValue,
} from '../src/index'

const coordinate = { lat: 40.7128, lon: -74.006 }
const bbox = {
	southWest: { lat: 40.4774, lon: -74.2591 },
	northEast: { lat: 40.9176, lon: -73.7004 },
}
const identification = {
	type: 'passport',
	number: 'A1',
	issuer: 'US',
	issueDate: '2020-01-15',
	expiryDate: '2030-01-14',
}
const attachment = {
	name: 'contract.pdf',
	mimeType: 'application/pdf',
	checksum: `sha256:${'a'.repeat(64)}`,
}
const signature = {
	timestamp: '2026-09-04T15:30:00Z',
	method: 'drawn' as const,
}

describe('@paradoc/format geography and capture values', () => {
	it('formats every capture family through direct, dynamic, and standalone operations', () => {
		const formatter = createFormatter()

		expect(formatter.formatCoordinate(coordinate)).toBe('40.7128,-74.006')
		expect(formatter.formatBbox(bbox)).toBe('40.4774,-74.2591,40.9176,-73.7004')
		expect(formatter.formatIdentification(identification)).toBe('passport: A1 (US, issued Jan 15, 2020, expires Jan 14, 2030)')
		expect(formatter.formatAttachment(attachment)).toBe('contract.pdf (application/pdf)')
		expect(formatter.formatSignature(signature)).toBe('Signature (drawn) on Sep 4, 2026')
		expect(formatCoordinate(coordinate)).toBe('40.7128,-74.006')
		expect(formatBbox(bbox)).toBe('40.4774,-74.2591,40.9176,-73.7004')
		expect(formatIdentification(identification)).toContain('passport: A1')
		expect(formatAttachment(attachment)).toBe('contract.pdf (application/pdf)')
		expect(formatSignature(signature)).toContain('Signature (drawn)')
		expect(safeFormatValue('coordinate', coordinate)).toMatchObject({ success: true, status: 'formatted', value: '40.7128,-74.006' })
		expect(safeFormatValue('signature', signature)).toMatchObject({ success: true, status: 'formatted' })
	})

	it('localizes nested dates and package-owned capture labels', () => {
		const formatter = createFormatter({ locale: 'de-DE' })

		expect(formatter.formatIdentification(identification)).toBe('passport: A1 (US, ausgestellt 15. Jan. 2020, gültig bis 14. Jan. 2030)')
		expect(formatter.formatSignature(signature)).toBe('Unterschrift (gezeichnet) am 4. Sept. 2026')

		const arabic = createFormatter({ locale: 'ar-SA' })
		expect(arabic.formatSignature(signature)).toContain('توقيع')
		expect(arabic.formatIdentification(identification)).toContain('صدر')
	})

	it('distinguishes missing, incomplete, and malformed composite members', () => {
		const formatter = createFormatter()

		expect(formatter.safeFormatCoordinate(undefined)).toMatchObject({ success: false, status: 'missing' })
		expect(formatter.safeFormatCoordinate({ lat: 1 })).toMatchObject({ success: false, status: 'incomplete' })
		expect(formatter.safeFormatCoordinate({ lat: Number.NaN, lon: 1 })).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatBbox({ southWest: { lat: 1, lon: 1 }, northEast: { lat: 0, lon: 2 } })).toMatchObject({
		success: false,
		status: 'invalid',
	})
		expect(formatter.safeFormatBbox({ southWest: { lat: 'bad' }, northEast: undefined })).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatIdentification({ type: 7 })).toMatchObject({ success: false, status: 'invalid' })
		expect(formatter.safeFormatAttachment({ name: 'x', mimeType: 'text/plain', checksum: 'bad' })).toMatchObject({
		success: false,
		status: 'invalid',
	})
		expect(formatter.safeFormatSignature({ method: 'drawn' })).toMatchObject({ success: false, status: 'incomplete' })
		expect(formatter.safeFormatSignature({ timestamp: 'not-a-date', method: 'drawn' })).toMatchObject({ success: false, status: 'invalid' })
	})

	it('retains nested issue paths when a supplied member is malformed', () => {
		const formatter = createFormatter()
		const bboxResult = formatter.safeFormatBbox({ southWest: { lat: 'bad' }, northEast: undefined })
		if (bboxResult.success) throw new Error('expected bbox failure')
		expect(bboxResult.issues.map((item) => item.path)).toEqual(['southWest.lat', 'southWest.lon', 'northEast'])

		const signatureResult = formatter.safeFormatSignature({ timestamp: '2026-01-01T00:00:00+25:00' })
		if (signatureResult.success) throw new Error('expected signature failure')
		expect(signatureResult.issues.map((item) => item.path)).toContain('timestamp.offset')
		expect(signatureResult.issues.map((item) => item.path)).toContain('method')
	})

	it('composes capture options and overrides without mutating the base formatter', () => {
		const base = createFormatter()
		const custom = base
			.compose({ coordinate: { maximumFractionDigits: 1 } })
			.withOverrides({
				coordinate: (value, options, context) => `[${context.delegate(value, options)}]`,
				signature: (value, options, context) => `captured: ${context.delegate(value, options)}`,
			})

		expect(base.formatCoordinate(coordinate)).toBe('40.7128,-74.006')
		expect(custom.formatCoordinate(coordinate)).toBe('[40.7,-74]')
		expect(custom.formatBbox(bbox)).toBe('[40.5,-74.3],[40.9,-73.7]')
		expect(custom.formatSignature(signature)).toBe('captured: Signature (drawn) on Sep 4, 2026')

		const broken = base.withOverrides({ coordinate: () => 42 as never })
		expect(broken.safeFormatCoordinate(coordinate)).toMatchObject({ success: false, status: 'error' })

		const temporalChild = base.withOverrides({
			date: (value, options, context) => `date:${context.delegate(value, options)}`,
		})
		expect(temporalChild.formatIdentification(identification)).toContain('issued date:Jan 15, 2020')
		expect(temporalChild.formatSignature(signature)).toContain('on date:Sep 4, 2026')
	})

	it('accepts caller messages for another runtime locale while keeping its number/date locale', () => {
		const formatter = createFormatter({
			locale: 'es-ES',
			messages: {
				'es-ES': {
					'identification.issueDate': 'emitido el {value}',
					'identification.expiryDate': 'caduca el {value}',
					'signature.type.signature': 'Firma',
					'signature.method.drawn': 'dibujada',
					'signature.on': 'el',
				},
			},
		})

		expect(formatter.formatIdentification({ ...identification, issuer: undefined, expiryDate: undefined })).toBe('passport: A1 (emitido el 15 ene 2020)')
		expect(formatter.formatSignature(signature)).toBe('Firma (dibujada) el 4 sept 2026')
		expect(createFormatter({ locale: 'es-ES' }).safeFormatSignature(signature)).toMatchObject({ success: false, status: 'unsupported' })
	})
})
