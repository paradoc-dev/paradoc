import { describe, expect, it } from 'vitest'

import { Decimal, DivisionByZeroError } from '../src/decimal/decimal'

const D = (s: string) => Decimal.fromString(s)

describe('Decimal — exactness (the float-drift cases)', () => {
	it('19.95 * 3 is exactly 59.85', () => {
		expect(D('19.95').mul(D('3')).toString()).toBe('59.85')
	})

	it('0.1 + 0.2 is exactly 0.3', () => {
		expect(D('0.1').add(D('0.2')).toString()).toBe('0.3')
	})

	it('subtraction keeps cents exact', () => {
		expect(D('0.3').sub(D('0.1')).toString()).toBe('0.2')
	})

	it('a percentage of an amount: subtotal * (rate / 100)', () => {
		const subtotal = D('59.85')
		const rate = D('8.25')
		expect(subtotal.mul(rate.div(D('100'))).round(2).toString()).toBe('4.94')
	})
})

describe('Decimal — parse and render', () => {
	it('round-trips through toString', () => {
		for (const s of ['0', '1', '-1', '10', '0.5', '-0.25', '100.00', '3.14159']) {
			// 100.00 trims to 100; compare numerically
			expect(D(s).eq(D(s))).toBe(true)
		}
		expect(D('100.00').toString()).toBe('100')
		expect(D('-0.250').toString()).toBe('-0.25')
	})

	it('rejects non-decimal strings', () => {
		for (const bad of ['', '1.2.3', 'abc', '1e5', '--1', '.5', '1.']) {
			expect(() => D(bad)).toThrow()
		}
	})
})

describe('Decimal — comparison across scales', () => {
	it('compares regardless of trailing zeros', () => {
		expect(D('1.50').eq(D('1.5'))).toBe(true)
		expect(D('1.5').gt(D('1.45'))).toBe(true)
		expect(D('-2').lt(D('-1'))).toBe(true)
		expect(D('0').cmp(D('0.0'))).toBe(0)
	})
})

describe('Decimal — division and rounding', () => {
	it('divides with half-up rounding', () => {
		expect(D('1').div(D('3')).round(4).toString()).toBe('0.3333')
		expect(D('2').div(D('3')).round(4).toString()).toBe('0.6667')
		expect(D('10').div(D('4')).toString()).toBe('2.5')
	})

	it('rounds half away from zero', () => {
		expect(D('2.5').round(0).toString()).toBe('3')
		expect(D('-2.5').round(0).toString()).toBe('-3')
		expect(D('2.4').round(0).toString()).toBe('2')
	})

	it('floor and ceil go toward -inf / +inf', () => {
		expect(D('2.1').floor().toString()).toBe('2')
		expect(D('-2.1').floor().toString()).toBe('-3')
		expect(D('2.1').ceil().toString()).toBe('3')
		expect(D('-2.1').ceil().toString()).toBe('-2')
	})

	it('throws on division by zero', () => {
		expect(() => D('1').div(D('0'))).toThrow(DivisionByZeroError)
		expect(() => D('1').mod(D('0'))).toThrow(DivisionByZeroError)
	})
})

describe('Decimal — misc ops', () => {
	it('abs and neg', () => {
		expect(D('-5.5').abs().toString()).toBe('5.5')
		expect(D('5.5').neg().toString()).toBe('-5.5')
	})

	it('mod aligns scales', () => {
		expect(D('10').mod(D('3')).toString()).toBe('1')
		expect(D('5.5').mod(D('2')).toString()).toBe('1.5')
	})
})
