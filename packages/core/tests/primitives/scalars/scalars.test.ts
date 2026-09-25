import { describe, expect, test } from 'vitest'
import { attachment } from '@/primitives/attachment'
import { date } from '@/primitives/date'
import { datetime } from '@/primitives/datetime'
import { percentage } from '@/primitives/percentage'
import { rating } from '@/primitives/rating'
import { signature } from '@/primitives/signature'
import { time } from '@/primitives/time'

describe('date', () => {
	test.each(['2024-02-29', '2023-12-31', '2000-01-01'])('accepts %s', (value) => {
		expect(date(value)).toBe(value)
		expect(date.isValid(value)).toBe(true)
	})

	test.each(['2023-02-29', '2024-04-31', '2024-13-01', '2024-1-01', '2024-01-01T00:00:00Z'])('rejects %s', (value) => {
		expect(date.isValid(value)).toBe(false)
		expect(() => date.parse(value)).toThrow('is not a valid ISO 8601 date')
		expect(date.safeParse(value).success).toBe(false)
	})

	test('rejects a value that is not a string', () => {
		expect(() => date.parse(20240101)).toThrow('expected string, got number')
	})
})

describe('time', () => {
	test.each(['00:00:00', '23:59:59', '12:30:15.250'])('accepts %s', (value) => {
		expect(time(value)).toBe(value)
		expect(time.isValid(value)).toBe(true)
	})

	test.each(['24:00:00', '12:60:00', '12:30', '1:02:03'])('rejects %s', (value) => {
		expect(time.isValid(value)).toBe(false)
		expect(() => time.parse(value)).toThrow('is not a valid time format')
	})

	test('rejects a value that is not a string', () => {
		expect(time.safeParse(1200).success).toBe(false)
	})

	test('now() is a valid time', () => {
		expect(time.isValid(time.now())).toBe(true)
	})
})

describe('datetime', () => {
	test.each(['2024-02-29T10:00:00Z', '2024-02-29T10:00:00.123+05:30'])('accepts %s', (value) => {
		expect(datetime(value)).toBe(value)
		expect(datetime.isValid(value)).toBe(true)
	})

	test.each(['2024-02-29', '2024-02-29 10:00:00Z', '2024-02-29T10:00:00', '2024-02-29T25:00:00Z', '2024-02-29T10:00:00+24:00'])('rejects %s', (value) => {
		expect(datetime.isValid(value)).toBe(false)
		expect(() => datetime.parse(value)).toThrow('is not a valid ISO 8601 datetime')
	})

	test('fromDate() and now() give valid datetimes', () => {
		expect(datetime.fromDate(new Date(Date.UTC(2024, 1, 29, 10)))).toBe('2024-02-29T10:00:00.000Z')
		expect(datetime.isValid(datetime.now())).toBe(true)
	})
})

describe('percentage', () => {
	test('rounds to the precision', () => {
		expect(percentage(12.345)).toBe(12.35)
		expect(percentage.parse(12.345, { precision: 1 })).toBe(12.3)
	})

	test('accepts a value on the range bounds', () => {
		expect(percentage.parse(0, { min: 0, max: 100 })).toBe(0)
		expect(percentage.parse(100, { min: 0, max: 100 })).toBe(100)
		expect(percentage.isValid(50, { min: 0, max: 100 })).toBe(true)
	})

	test('rejects a value outside the range', () => {
		expect(() => percentage.parse(-1, { min: 0 })).toThrow('below the minimum (0)')
		expect(() => percentage.parse(101, { max: 100 })).toThrow('above the maximum (100)')
		expect(percentage.isValid(101, { max: 100 })).toBe(false)
		expect(percentage.isValid(-1, { min: 0 })).toBe(false)
	})

	test('rejects a value that is not a finite number', () => {
		expect(() => percentage.parse('50')).toThrow('expected number, got string')
		expect(() => percentage.parse(Number.NaN)).toThrow('must be a finite number')
		expect(percentage.safeParse(Number.POSITIVE_INFINITY).success).toBe(false)
	})

	test('converts between decimals and percentages', () => {
		expect(percentage.fromDecimal(0.125)).toBe(12.5)
		expect(percentage.toDecimal(12.5)).toBe(0.125)
	})
})

describe('rating', () => {
	test('accepts values on the step within the default 1-5 range', () => {
		expect(rating(1)).toBe(1)
		expect(rating(5)).toBe(5)
		expect(rating.parse(2.5, { step: 0.5 })).toBe(2.5)
		expect(rating.isValid(3)).toBe(true)
	})

	test('rejects a value off the step', () => {
		expect(() => rating.parse(2.5)).toThrow('does not align with step size 1')
		expect(() => rating.parse(2.25, { step: 0.5 })).toThrow('does not align with step size 0.5')
		expect(rating.isValid(2.5)).toBe(false)
	})

	test('rejects a value outside the range', () => {
		expect(() => rating.parse(0)).toThrow('outside the valid range (1-5)')
		expect(() => rating.parse(11, { max: 10 })).toThrow('outside the valid range (1-10)')
		expect(rating.isValid(6)).toBe(false)
	})

	test('rejects a value that is not a finite number', () => {
		expect(() => rating.parse('3')).toThrow('expected number, got string')
		expect(rating.safeParse(Number.NaN).success).toBe(false)
	})
})

describe('attachment', () => {
	test('builds an attachment from the builder and from input', () => {
		expect(attachment().name('lease.pdf').mimeType('application/pdf').build()).toEqual({
			name: 'lease.pdf',
			mimeType: 'application/pdf',
		})
		const checksum = `sha256:${'a'.repeat(64)}`
		expect(attachment({ name: 'id.png', mimeType: 'image/png', checksum }).build()).toEqual({
			name: 'id.png',
			mimeType: 'image/png',
			checksum,
		})
	})

	test('requires a name and a MIME type', () => {
		expect(() => attachment().mimeType('application/pdf').build()).toThrow('Attachment name is required')
		expect(() => attachment({ name: 'lease.pdf' }).build()).toThrow('Attachment mimeType is required')
	})
})

describe('signature', () => {
	test('builds a signature from the builder and from input', () => {
		expect(signature().timestamp('2024-02-29T10:00:00Z').method('typed').build()).toEqual({
			timestamp: '2024-02-29T10:00:00Z',
			method: 'typed',
		})
		expect(signature({ timestamp: '2024-02-29T10:00:00Z', method: 'drawn', image: 'data:image/png;base64,AA==' }).build())
			.toMatchObject({ method: 'drawn', image: 'data:image/png;base64,AA==' })
	})

	test('requires a timestamp and a method', () => {
		expect(() => signature().method('typed').build()).toThrow('Signature timestamp is required')
		expect(() => signature({ timestamp: '2024-02-29T10:00:00Z' }).build()).toThrow('Signature method is required')
	})
})
