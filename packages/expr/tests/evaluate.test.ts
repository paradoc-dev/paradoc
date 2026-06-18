import { describe, expect, it } from 'vitest'

import { createContext, evaluateExpression, evaluateBoolean, Values, type Value } from '../src/index'
import type { EvaluationContext } from '../src/index'

function unwrap(v: Value): unknown {
	switch (v.kind) {
		case 'number':
			return v.value.toString()
		case 'string':
			return v.value
		case 'boolean':
			return v.value
		case 'null':
			return null
		case 'array':
			return v.value.map(unwrap)
		case 'object':
			return Object.fromEntries([...v.value].map(([k, val]) => [k, unwrap(val)]))
	}
}

function run(src: string, data: Record<string, unknown> = {}, ctx?: Partial<Parameters<typeof createContext>[1]>): unknown {
	const r = evaluateExpression(src, createContext(data, ctx))
	if (!r.success) throw new Error(`eval failed: ${r.error}`)
	return unwrap(r.value)
}

describe('arithmetic — exact decimal', () => {
	it('computes money math exactly', () => {
		expect(run('fields.unitPrice * fields.quantity', { fields: { unitPrice: 19.95, quantity: 3 } })).toBe('59.85')
		expect(run('subtotal + tax', { subtotal: 100, tax: 8.25 })).toBe('108.25')
	})

	it('rejects division by zero as a failure, not a crash', () => {
		const r = evaluateExpression('1 / fields.n', createContext({ fields: { n: 0 } }))
		expect(r.success).toBe(false)
		if (!r.success) expect(r.code).toBe('division-by-zero')
	})
})

describe('polymorphic +', () => {
	it('concatenates when either side is a string', () => {
		expect(run('firstName + " " + lastName', { firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace')
		expect(run('"id-" + n', { n: 42 })).toBe('id-42')
	})
})

describe('comparison, logic, ternary', () => {
	it('compares numbers and strings', () => {
		expect(run('fields.age >= 18', { fields: { age: 18 } })).toBe(true)
		expect(run('a < b', { a: 'apple', b: 'banana' })).toBe(true)
	})

	it('does not coerce across types in equality', () => {
		expect(run('n == s', { n: 1, s: '1' })).toBe(false)
	})

	it('short-circuits and/or', () => {
		expect(run('ssn or ein', { ssn: '', ein: '12-3' })).toBe(true)
		expect(run('not (a and b)', { a: true, b: false })).toBe(true)
	})

	it('evaluates ternary branches', () => {
		expect(run('fields.age < 18 ? "minor" : "adult"', { fields: { age: 30 } })).toBe('adult')
	})
})

describe('membership', () => {
	it('in / not in over arrays and strings', () => {
		expect(run('x in ["a", "b"]', { x: 'b' })).toBe(true)
		expect(run('x not in ["a", "b"]', { x: 'c' })).toBe(true)
		expect(run('"lo" in "hello"', {})).toBe(true)
	})
})

describe('null-safety and presence', () => {
	it('member access on a null/missing parent yields null, never throws', () => {
		expect(run('fields.rent.amount', { fields: {} })).toBe(null)
		expect(run('fields.rent.amount', { fields: { rent: null } })).toBe(null)
	})

	it('supports a first-class null literal and == null', () => {
		expect(run('fields.ssn == null', { fields: {} })).toBe(true)
		expect(run('fields.ssn == null', { fields: { ssn: '123' } })).toBe(false)
	})

	it('length of null/unset collections is 0', () => {
		expect(run('length(fields.tags)', { fields: {} })).toBe('0')
		expect(run('length(fields.tags)', { fields: { tags: null } })).toBe('0')
		expect(run('length(fields.tags)', { fields: { tags: ['a', 'b'] } })).toBe('2')
	})
})

describe('string and number functions', () => {
	it('string predicates', () => {
		expect(run('startsWith(fields.zip, "9")', { fields: { zip: '94016' } })).toBe(true)
		expect(run('contains(fields.tags, "x")', { fields: { tags: ['x', 'y'] } })).toBe(true)
		expect(run('upper(trim(" hi "))', {})).toBe('HI')
		expect(run('isEmpty(fields.note)', { fields: {} })).toBe(true)
		expect(run('coalesce(fields.a, fields.b, "default")', { fields: { a: null } })).toBe('default')
	})

	it('decimal-aware number functions', () => {
		expect(run('round(fields.x, 2)', { fields: { x: 1.005 } })).toBe('1.01')
		expect(run('min(3, 1, 2)', {})).toBe('1')
		expect(run('max(3, 1, 2)', {})).toBe('3')
		expect(run('abs(0 - 5)', {})).toBe('5')
	})
})

describe('temporal functions (injected as-of clock)', () => {
	const asOf = { date: '2026-06-18', datetime: '2026-06-18T12:00:00Z' }

	it('today() comes from the context, not the wall clock', () => {
		expect(run('today()', {}, { asOf })).toBe('2026-06-18')
	})

	it('computes age and intervals', () => {
		expect(run('yearsBetween(fields.dob, today())', { fields: { dob: '2000-01-01' } }, { asOf })).toBe('26')
		expect(run('dateDiff("2026-06-18", "2026-06-28")', {})).toBe('10')
	})

	it('adds days and durations', () => {
		expect(run('addDays(fields.start, 30)', { fields: { start: '2026-01-01' } })).toBe('2026-01-31')
		expect(run('addDuration(fields.start, "P1Y")', { fields: { start: '2026-01-01' } })).toBe('2027-01-01')
	})

	it('today() without an as-of clock fails cleanly', () => {
		const r = evaluateExpression('today()', createContext({}))
		expect(r.success).toBe(false)
		if (!r.success) expect(r.code).toBe('missing-clock')
	})
})

describe('host-injected domain functions', () => {
	it('dispatches party functions from the context', () => {
		const ctx: EvaluationContext = {
			lookup: () => undefined,
			hostFunctions: {
				partyCount: (args) => {
					const role = args[0]
					return Values.num(role && role.kind === 'string' && role.value === 'buyer' ? '2' : '0')
				},
			},
		}
		const r = evaluateExpression('partyCount("buyer") > 0', ctx)
		expect(r.success).toBe(true)
		if (r.success) expect(r.value).toEqual(Values.boolean(true))
	})

	it('reports an unknown function', () => {
		const r = evaluateExpression('mystery(1)', createContext({}))
		expect(r.success).toBe(false)
		if (!r.success) expect(r.code).toBe('unknown-function')
	})
})

describe('evaluateBoolean — gate semantics', () => {
	it('short-circuits boolean literals and defaults on failure', () => {
		const ctx = createContext({ fields: { age: 20 } })
		expect(evaluateBoolean(true, ctx, false)).toBe(true)
		expect(evaluateBoolean(undefined, ctx, true)).toBe(true)
		expect(evaluateBoolean('fields.age >= 18', ctx, false)).toBe(true)
		// A failing expression falls back to the default rather than throwing.
		expect(evaluateBoolean('1 / 0 > 0', ctx, false)).toBe(false)
	})
})
