import { describe, expect, it } from 'vitest'

import { buildRegistry, createContext, evaluateExpression, evaluateBoolean, EvaluationError, T, Values, type FnSignature, type Value } from '../src/index'
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

describe('host function guards', () => {
	const outcome = (src: string, opts: Parameters<typeof createContext>[1]) => {
		const r = evaluateExpression(src, createContext({}, opts))
		return r.success ? { value: unwrap(r.value) } : { code: r.code, error: r.error }
	}
	const trimOverride: FnSignature = { name: 'trim', category: 'string', params: [{ name: 'value', type: T.string }], returns: { kind: 'fixed', type: T.string }, deterministic: true }
	const overridden = buildRegistry([trimOverride], { explicitOverrides: ['trim'] })

	it('accepts a host result that is a value of the declared type', () => {
		expect(outcome('partyCount("buyer")', { hostFunctions: { partyCount: () => Values.num('2') } })).toEqual({ value: '2' })
	})

	it('rejects a host result that is not a value', () => {
		const bad = () => ({ kind: 'number', value: 2 }) as unknown as Value
		expect(outcome('partyCount("buyer")', { hostFunctions: { partyCount: bad } })).toEqual({ code: 'host-error', error: 'Host function partyCount returned an invalid value' })
	})

	it('rejects a host result of the wrong type', () => {
		expect(outcome('partyCount("buyer")', { hostFunctions: { partyCount: () => Values.string('2') } })).toEqual({ code: 'host-error', error: 'Host function partyCount returned string, expected number' })
	})

	it('uses a host function in place of a builtin only when the registry overrides it', () => {
		const shout = () => Values.string('SHOUT')
		expect(outcome('trim(" a ")', { registry: overridden, hostFunctions: { trim: shout } })).toEqual({ value: 'SHOUT' })
		expect(outcome('trim(" a ")', { hostFunctions: { trim: shout } })).toEqual({ code: 'type-error', error: 'Host function trim collides with a builtin without an explicit override' })
	})

	it('fails an override that has no host implementation', () => {
		expect(outcome('trim(" a ")', { registry: overridden })).toEqual({ code: 'missing-capability', error: 'Override trim requires a host implementation' })
	})

	it('fails a host-injected function the host does not supply', () => {
		expect(outcome('partyCount("buyer")', {})).toEqual({ code: 'missing-capability', error: 'Function partyCount requires a host capability' })
	})
})

describe('safe API failure codes', () => {
	const code = (src: string) => {
		const r = evaluateExpression(src, createContext({}))
		return r.success ? 'success' : r.code
	}

	it('reports a source over the nesting bound as limit-exceeded', () => {
		expect(code('('.repeat(300) + '1' + ')'.repeat(300))).toBe('limit-exceeded')
	})

	it('reports a source that does not parse as syntax', () => {
		expect(code('1 +')).toBe('syntax')
		expect(code('(1)')).toBe('success')
	})

	it('reports bad round digits as a type error and too many as a limit', () => {
		expect(code('round(1.5, 0.5)')).toBe('type-error')
		expect(code('round(1.5, -1)')).toBe('type-error')
		expect(code('round(1.5, 1001)')).toBe('limit-exceeded')
		expect(code('round(1.25, 1)')).toBe('success')
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

describe('string keys', () => {
	it('reads a member whose key is not an identifier', () => {
		const keyed = createContext({ items: { 'signed-contract': true, plain: 'x' } })
		expect(evaluateExpression('items["signed-contract"]', keyed)).toEqual({ success: true, value: Values.boolean(true) })
		expect(evaluateExpression('items["missing"]', keyed)).toEqual({ success: true, value: Values.null })
		expect(evaluateExpression('items.plain', keyed)).toEqual({ success: true, value: Values.string('x') })
	})
})

describe('missing inputs', () => {
	const failure = (src: string, data: Record<string, unknown>) => {
		const r = evaluateExpression(src, createContext(data))
		if (r.success) throw new Error(`expected ${src} to not evaluate`)
		return r
	}

	it('reports an expression over an input with no value as missing, naming the input', () => {
		const r = failure('fields.subtotal * 0.0825', { fields: { subtotal: null } })
		expect(r.code).toBe('missing-input')
		expect(r.missing).toEqual(['fields.subtotal'])
	})

	it('treats an absent member and a missing computed value as missing', () => {
		expect(failure('fields.qty * fields.price', { fields: { price: 2 } }).missing).toEqual(['fields.qty'])
		expect(failure('total + 1', { total: null, fields: {} }).missing).toEqual(['total'])
	})

	it('treats a list path as missing when any row lacks the value', () => {
		const rows = [{ amount: 1 }, { amount: null }]
		expect(failure('fields.items.amount * 2', { fields: { items: rows } }).code).toBe('missing-input')
	})

	it('keeps a failure with every input present as a failure', () => {
		expect(failure('fields.subtotal * 2', { fields: { subtotal: 'ten' } }).code).toBe('type-error')
		expect(failure('fields.a / fields.b', { fields: { a: 1, b: 0 } }).code).toBe('division-by-zero')
		expect(failure('fields.items.amount * 2', { fields: { items: [{ amount: 1 }] } }).code).toBe('type-error')
		const currencies = { fields: { items: [{ amount: { amount: 1, currency: 'USD' } }, { amount: { amount: 2, currency: 'EUR' } }] } }
		expect(failure('sum(fields.items.amount)', currencies).code).toBe('currency-mismatch')
	})

	it('returns the failure of a lookup that throws instead of throwing it', () => {
		const ctx: EvaluationContext = {
			lookup: (name) => {
				if (name === 'bad') throw new EvaluationError('type-error', 'bad cannot be read')
				return undefined
			},
			hostFunctions: {},
		}
		expect(evaluateExpression('count(bad.rows)', ctx)).toMatchObject({ success: false, code: 'type-error', error: 'bad cannot be read' })
		expect(evaluateExpression('bad * 2', ctx)).toMatchObject({ success: false, code: 'type-error' })
	})

	it('does not treat a name the context does not define as a missing input', () => {
		expect(failure('undeclared + 1', { fields: {} }).code).toBe('type-error')
	})

	it('does not treat an authoring error as missing even when an input is missing', () => {
		expect(failure('nope(fields.a)', { fields: { a: null } }).code).toBe('unknown-function')
	})

	it('reports only the missing inputs the failing operation reads', () => {
		expect(failure('coalesce(fields.a, fields.b) * 2', { fields: { a: null, b: null } }).missing).toEqual(['fields.a', 'fields.b'])
		expect(failure('upper(fields.x)', { fields: { x: null } }).missing).toEqual(['fields.x'])
		expect(failure('coalesce(fields.x, 0) + fields.y * 2', { fields: { x: null, y: null } }).missing).toEqual(['fields.y'])
	})

	it('keeps a failure that a handled or unrelated missing input did not cause', () => {
		const src = '(fields.total - coalesce(fields.discount, 0)) / fields.count'
		const r = failure(src, { fields: { total: 10, discount: null, count: 0 } })
		expect({ code: r.code, missing: r.missing }).toEqual({ code: 'division-by-zero', missing: undefined })
		expect(failure(src, { fields: { total: 10, discount: 1, count: 0 } }).code).toBe('division-by-zero')
		expect(failure('fields.name * 2 + coalesce(fields.x, 0)', { fields: { name: 'bob', x: null } }).code).toBe('type-error')
	})

	it('evaluates an expression that handles the missing value itself', () => {
		expect(run('coalesce(fields.qty, 0) * 2', { fields: { qty: null } })).toBe('0')
		expect(run('fields.qty == null ? null : fields.qty * 2', { fields: { qty: null } })).toBeNull()
	})
})
