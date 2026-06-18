import { describe, expect, it } from 'vitest'

import {
	Decimal,
	createContext,
	evaluateExpression,
	check,
	checkBooleanGate,
	createTypeEnv,
	extractReferences,
	parse,
	tokenize,
	toValue,
	truthy,
	valueToString,
	valueEquals,
	Values,
	T,
	type Value,
} from '../src/index'

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

function run(src: string, data: Record<string, unknown> = {}, opts?: Parameters<typeof createContext>[1]): unknown {
	const r = evaluateExpression(src, createContext(data, opts))
	if (!r.success) throw new Error(`unexpected eval failure: ${r.error}`)
	return unwrap(r.value)
}

/** Expect a runtime failure and return its error code. */
function failCode(src: string, data: Record<string, unknown> = {}): string | undefined {
	const r = evaluateExpression(src, createContext(data))
	expect(r.success).toBe(false)
	return r.success ? undefined : r.code
}

const D = (s: string) => Decimal.fromString(s)

// ─────────────────────────────────────────── Decimal edge cases

describe('Decimal — rounding modes and edges', () => {
	it('round respects down / floor / ceil', () => {
		expect(D('2.5').round(0, 'down').toString()).toBe('2')
		expect(D('-2.5').round(0, 'floor').toString()).toBe('-3')
		expect(D('-2.5').round(0, 'ceil').toString()).toBe('-2')
	})

	it('round clamps negative and fractional digits to a valid scale', () => {
		expect(D('123.456').round(-1).toString()).toBe('123')
		expect(D('1.555').round(2.9).toString()).toBe('1.56')
	})

	it('round pads when asked for more places than present', () => {
		expect(D('1.5').round(4).toString()).toBe('1.5')
	})

	it('fromInt truncates a float and supports bigint', () => {
		expect(Decimal.fromInt(3.9).toString()).toBe('3')
		expect(Decimal.fromInt(-1n).toString()).toBe('-1')
	})

	it('toNumber is a lossy interop bridge', () => {
		expect(D('1.5').toNumber()).toBe(1.5)
		expect(D('100').toNumber()).toBe(100)
	})

	it('mod with a negative dividend truncates toward zero', () => {
		expect(D('-7').mod(D('3')).toString()).toBe('-1')
	})
})

// ─────────────────────────────────────────── Lexer edge cases

describe('lexer — escapes and bad input', () => {
	it('decodes escape sequences', () => {
		expect(tokenize('"a\\nb"')[0]!.value).toBe('a\nb')
		expect(tokenize("'it\\'s'")[0]!.value).toBe("it's")
		expect(tokenize('"a\\xb"')[0]!.value).toBe('axb') // unknown escape passes through
	})

	it('reports an unexpected character as a syntax error', () => {
		const r = parse('a @ b')
		expect(r.ast).toBeNull()
		expect(r.errors[0]!.code).toBe('syntax')
		expect(r.errors[0]!.message).toMatch(/Unexpected character/)
	})
})

// ─────────────────────────────────────────── Value helpers

describe('value helpers', () => {
	it('valueToString covers every kind', () => {
		expect(run('"b=" + (1 == 1)')).toBe('b=true')
		expect(run('"v=" + arr', { arr: [1, 2] })).toBe('v=1,2')
		expect(run('"x" + fields.missing', { fields: {} })).toBe('x') // null renders empty
	})

	it('valueEquals over arrays and objects', () => {
		expect(run('a == b', { a: [1, 2], b: [1, 2] })).toBe(true)
		expect(run('a == b', { a: [1, 2], b: [1, 3] })).toBe(false)
		expect(run('a == b', { a: { x: 1 }, b: { x: 1 } })).toBe(true)
		expect(run('a == b', { a: { x: 1 }, b: { x: 2 } })).toBe(false)
	})

	it('toValue handles bigint and nesting; truthy covers each kind', () => {
		expect(toValue(10n)).toEqual(Values.num('10'))
		expect(truthy(Values.num('0'))).toBe(false)
		expect(truthy(Values.array([]))).toBe(false)
		expect(truthy(Values.object([['x', Values.num('1')]]))).toBe(true)
		expect(valueToString(Values.array([Values.num('1'), Values.string('a')]))).toBe('1,a')
	})
})

// ─────────────────────────────────────────── Evaluator unhappy paths

describe('evaluator — runtime type errors degrade, never crash', () => {
	it.each([
		['negate a string', '- s', { s: 'a' }],
		['subtract strings', 's - 1', { s: 'a' }],
		['membership in a number', '1 in n', { n: 5 }],
		['string membership of a non-string', 'n in s', { n: 1, s: 'abc' }],
		['add boolean and number', 'b + n', { b: true, n: 1 }],
	])('%s -> type-error', (_label, src, data) => {
		expect(failCode(src, data)).toBe('type-error')
	})

	it('ordered comparison of incomparable/missing operands degrades to false', () => {
		expect(run('n < s', { n: 1, s: 'a' })).toBe(false)
		expect(run('fields.age >= 18', { fields: {} })).toBe(false) // missing -> null -> false
	})

	it('null-safe access and indexing never throw', () => {
		expect(run('n.x', { n: 5 })).toBe(null) // member on non-object -> null
		expect(run('arr[0]', { arr: [10, 20] })).toBe('10')
		expect(run('arr[5]', { arr: [10, 20] })).toBe(null) // out of range
		expect(run('arr["k"]', { arr: [1] })).toBe(null) // non-number index
		expect(run('n[0]', { n: 5 })).toBe(null) // index on non-array
	})

	it('coalesce returns null when everything is null', () => {
		expect(run('coalesce(a, b)', { a: null, b: null })).toBe(null)
	})
})

describe('functions — unhappy paths', () => {
	it.each([
		['contains on a number', 'contains(n, 1)', { n: 5 }, 'type-error'],
		['length on a number', 'length(n)', { n: 5 }, 'type-error'],
		['startsWith with a number', 'startsWith(n, "9")', { n: 5 }, 'type-error'],
		['min with no args', 'min()', {}, 'arity'],
	])('%s', (_label, src, data, code) => {
		expect(failCode(src, data)).toBe(code)
	})

	it('matches with an invalid pattern fails as a type-error', () => {
		expect(failCode('matches("x", "(")')).toBe('type-error')
	})
})

describe('temporal — units, durations, invalid input', () => {
	it('dateDiff supports months and years', () => {
		expect(run('dateDiff("2026-01-01", "2026-04-01", "months")')).toBe('3')
		expect(run('dateDiff("2000-01-01", "2026-06-18", "years")')).toBe('26')
	})

	it('addDuration handles weeks and days', () => {
		expect(run('addDuration("2026-01-01", "P2W")')).toBe('2026-01-15')
		expect(run('addDuration("2026-01-31", "P1M")')).toBe('2026-03-03') // Feb overflow, UTC math
	})

	it.each([
		['unknown unit', 'dateDiff("2026-01-01", "2026-02-01", "fortnights")'],
		['invalid duration', 'addDuration("2026-01-01", "P")'],
		['invalid date', 'addDays("not-a-date", 1)'],
	])('%s -> type-error', (_label, src) => {
		expect(failCode(src)).toBe('type-error')
	})
})

// ─────────────────────────────────────────── Checker edge inference

describe('checker — edge inference', () => {
	const env = createTypeEnv({
		fields: T.object,
		'fields.age': T.number,
		'fields.name': T.string,
		'fields.tags': T.array(T.string),
		isAdult: T.boolean,
		arr: T.array(T.number),
	})
	const codes = (src: string) => check(src, env).diagnostics.map((d) => d.code)

	it('infers indexed element type and flags non-number indices', () => {
		expect(check('arr[0]', env).type).toEqual(T.number)
		expect(check('arr[0] > 1', env).diagnostics).toEqual([])
		expect(codes('arr["k"]')).toContain('type-mismatch')
	})

	it('a ternary with mismatched branches infers unknown without error', () => {
		const r = check('isAdult ? fields.name : fields.age', env)
		expect(r.diagnostics).toEqual([])
		expect(r.type).toEqual(T.unknown)
	})

	it('array literals: uniform vs mixed vs empty', () => {
		expect(check('[1, 2, 3]', env).type).toEqual(T.array(T.number))
		expect(check('[1, "a"]', env).type).toEqual(T.array(T.unknown))
		expect(check('[]', env).type).toEqual(T.array(T.unknown))
	})

	it('coalesce return type is the common type of its arguments', () => {
		expect(check('coalesce(fields.name, "x")', env).type).toEqual(T.string)
		expect(check('coalesce(fields.name, fields.age)', env).type).toEqual(T.unknown)
	})

	it('flags membership over a non-collection and negation of a string', () => {
		expect(codes('1 in fields.age')).toContain('type-mismatch')
		expect(codes('- fields.name')).toContain('type-mismatch')
		expect(codes('fields.age + isAdult')).toContain('type-mismatch')
	})

	it('member access through a call is unknown, not an error', () => {
		const r = check('today().foo', env)
		expect(r.diagnostics).toEqual([])
		expect(r.type).toEqual(T.unknown)
	})

	it('unknown-typed gate is allowed (not forced boolean)', () => {
		expect(checkBooleanGate('coalesce(fields.name, fields.age)', env).diagnostics).toEqual([])
	})

	it('does not cascade errors off an unknown reference', () => {
		// fields.age is known; an unknown ref yields exactly one diagnostic, no arithmetic cascade
		expect(codes('fields.ghost + fields.age')).toEqual(['unknown-identifier'])
	})
})

// ─────────────────────────────────────────── Parser error branches

describe('parser — error branches', () => {
	it.each([
		['unclosed paren', '(1 + 2'],
		['unclosed array', '[1, 2'],
		['unclosed call args', 'min(1, 2'],
		['dangling member', 'fields.'],
		['unclosed index', 'arr[1'],
		['leading operator keyword', 'and x'],
		['trailing comma in array', '[1,]'],
	])('%s -> syntax error', (_label, src) => {
		const r = parse(src)
		expect(r.ast).toBeNull()
		expect(r.errors[0]!.code).toBe('syntax')
	})
})

// ─────────────────────────────────────────── Reference extraction edges

describe('reference extraction — edges', () => {
	it('ignores call names and collects nested arg references', () => {
		const refs = extractReferences(parse('foo(a, b.c)').ast!)
		expect(refs.paths).toEqual(['a', 'b.c'])
		expect(refs.fullyStatic).toBe(true)
	})

	it('a member through a call contributes no static path', () => {
		const refs = extractReferences(parse('today().x').ast!)
		expect(refs.paths).toEqual([])
	})
})
