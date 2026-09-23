import { describe, expect, it } from 'vitest'

import { check, checkBooleanGate, createContext, createTypeEnv, evaluateExpression, extractReferences, parseOrThrow, T } from '../src/index'
import type { ContextOptions, RowVisibility, Value } from '../src/index'

function unwrap(v: Value): unknown {
	switch (v.kind) {
		case 'number':
			return v.value.toString()
		case 'string':
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

function run(src: string, fields: Record<string, unknown>, opts: ContextOptions = {}): unknown {
	const r = evaluateExpression(src, createContext({ fields, threshold: 100 }, opts))
	if (!r.success) throw new Error(`eval failed: ${r.error}`)
	return unwrap(r.value)
}

function failure(src: string, fields: Record<string, unknown>) {
	const r = evaluateExpression(src, createContext({ fields }))
	if (r.success) throw new Error(`expected a failure, got ${JSON.stringify(unwrap(r.value))}`)
	return r
}

const usd = (amount: number) => ({ amount, currency: 'USD' })

const items = [
	{ amount: usd(100), qty: 2, taxable: true, kind: 'service', due: '2026-03-01' },
	{ amount: usd(40.5), qty: 1, taxable: false, kind: 'other', due: '2026-01-15' },
	{ amount: usd(9.5), qty: 4, taxable: true, kind: 'service', due: '2026-02-10' },
]

describe('aggregates over a populated list', () => {
	it('sums money and keeps its currency', () => {
		expect(run('sum(fields.items.amount)', { items })).toEqual({ amount: '150', currency: 'USD' })
	})

	it('sums numbers, counts rows, and averages', () => {
		expect(run('sum(fields.items.qty)', { items })).toBe('7')
		expect(run('count(fields.items)', { items })).toBe('3')
		expect(run('avg(fields.items.qty)', { items })).toBe('2.33333333333333333333')
		expect(run('avg(fields.items.amount)', { items })).toEqual({ amount: '50', currency: 'USD' })
	})

	it('finds the least and greatest number, money, and date', () => {
		expect(run('min(fields.items.qty)', { items })).toBe('1')
		expect(run('max(fields.items.qty)', { items })).toBe('4')
		expect(run('max(fields.items.amount)', { items })).toEqual({ amount: '100', currency: 'USD' })
		expect(run('min(fields.items.due)', { items })).toBe('2026-01-15')
	})

	it('tests every row and any row', () => {
		expect(run('any(fields.items.taxable)', { items })).toBe(true)
		expect(run('all(fields.items.taxable)', { items })).toBe(false)
	})
})

describe('filters', () => {
	it('keeps only rows whose filter is true', () => {
		expect(run('sum(fields.items.amount, fields.items.taxable)', { items })).toEqual({ amount: '109.5', currency: 'USD' })
		expect(run('count(fields.items, fields.items.kind == "other")', { items })).toBe('1')
		expect(run('max(fields.items.qty, not fields.items.taxable)', { items })).toBe('1')
		expect(run('all(fields.items.taxable, fields.items.kind == "service")', { items })).toBe(true)
	})

	it('reads values outside the list as they are', () => {
		expect(run('count(fields.items, fields.items.amount.amount >= threshold)', { items })).toBe('1')
	})

	it('filters to nothing and returns the empty results', () => {
		const none = 'fields.items.qty > 99'
		expect(run(`sum(fields.items.qty, ${none})`, { items })).toBe('0')
		expect(run(`count(fields.items, ${none})`, { items })).toBe('0')
		expect(run(`avg(fields.items.qty, ${none})`, { items })).toBe(null)
		expect(run(`min(fields.items.qty, ${none})`, { items })).toBe(null)
		expect(run(`any(fields.items.taxable, ${none})`, { items })).toBe(false)
		expect(run(`all(fields.items.taxable, ${none})`, { items })).toBe(true)
	})
})

describe('empty and absent lists', () => {
	for (const [label, fields] of [['an empty list', { items: [] }], ['an absent list', {}]] as const) {
		it(`defines every result for ${label}`, () => {
			expect(run('sum(fields.items.amount)', fields)).toBe('0')
			expect(run('count(fields.items)', fields)).toBe('0')
			expect(run('min(fields.items.qty)', fields)).toBe(null)
			expect(run('max(fields.items.qty)', fields)).toBe(null)
			expect(run('avg(fields.items.qty)', fields)).toBe(null)
			expect(run('any(fields.items.taxable)', fields)).toBe(false)
			expect(run('all(fields.items.taxable)', fields)).toBe(true)
		})
	}

	it('skips absent values but counts their rows', () => {
		const sparse = [{ qty: 3 }, { qty: null }, {}]
		expect(run('sum(fields.items.qty)', { items: sparse })).toBe('3')
		expect(run('avg(fields.items.qty)', { items: sparse })).toBe('3')
		expect(run('min(fields.items.qty)', { items: sparse })).toBe('3')
		expect(run('count(fields.items.qty)', { items: sparse })).toBe('3')
		expect(run('all(fields.items.flag)', { items: [{ flag: true }, {}] })).toBe(false)
	})
})

describe('nested lists', () => {
	const orders = [
		{ rush: true, parts: [{ cost: 10, spare: false }, { cost: 5, spare: true }] },
		{ rush: false, parts: [{ cost: 7, spare: true }] },
		{ rush: true, parts: [] },
	]

	it('collects values from every level', () => {
		expect(run('sum(fields.orders.parts.cost)', { orders })).toBe('22')
		expect(run('count(fields.orders.parts)', { orders })).toBe('3')
	})

	it('evaluates a filter against the row at its own depth', () => {
		expect(run('sum(fields.orders.parts.cost, fields.orders.rush)', { orders })).toBe('15')
		expect(run('sum(fields.orders.parts.cost, fields.orders.parts.spare)', { orders })).toBe('12')
		expect(run('sum(fields.orders.parts.cost, fields.orders.rush and fields.orders.parts.spare)', { orders })).toBe('5')
	})

	it('aggregates the current row inside a filter', () => {
		expect(run('count(fields.orders, count(fields.orders.parts) > 1)', { orders })).toBe('1')
	})
})

describe('hidden rows', () => {
	const hideSecond: RowVisibility = (listPath, indices) => !(listPath === 'fields.items' && indices[0] === 1)

	it('never contribute', () => {
		expect(run('sum(fields.items.amount)', { items }, { rowVisible: hideSecond })).toEqual({ amount: '109.5', currency: 'USD' })
		expect(run('count(fields.items)', { items }, { rowVisible: hideSecond })).toBe('2')
		expect(run('all(fields.items.taxable)', { items }, { rowVisible: hideSecond })).toBe(true)
	})

	it('change the result when a row is shown again', () => {
		expect(run('sum(fields.items.qty)', { items }, { rowVisible: () => true })).toBe('7')
		expect(run('sum(fields.items.qty)', { items }, { rowVisible: hideSecond })).toBe('6')
	})

	it('leave the empty results when every row is hidden', () => {
		const hidden: RowVisibility = () => false
		expect(run('sum(fields.items.amount)', { items }, { rowVisible: hidden })).toBe('0')
		expect(run('count(fields.items)', { items }, { rowVisible: hidden })).toBe('0')
		expect(run('max(fields.items.qty)', { items }, { rowVisible: hidden })).toBe(null)
		expect(run('avg(fields.items.qty)', { items }, { rowVisible: hidden })).toBe(null)
		expect(run('any(fields.items.taxable)', { items }, { rowVisible: hidden })).toBe(false)
		expect(run('all(fields.items.taxable)', { items }, { rowVisible: hidden })).toBe(true)
	})

	it('are asked about with the list path and every level of the row position', () => {
		const asked: string[] = []
		const orders = [{ parts: [{ cost: 1 }] }, { parts: [{ cost: 2 }, { cost: 3 }] }]
		run('sum(fields.orders.parts.cost)', { orders }, {
			rowVisible: (listPath, indices) => {
				asked.push(`${listPath}@${indices.join(',')}`)
				return !(listPath === 'fields.orders.parts' && indices.join(',') === '1,1')
			},
		})
		expect(asked).toEqual([
			'fields.orders@0',
			'fields.orders@1',
			'fields.orders.parts@0,0',
			'fields.orders.parts@1,0',
			'fields.orders.parts@1,1',
		])
	})
})

describe('money precision and currency', () => {
	it('keeps exact decimals in a single-currency sum', () => {
		const rows = [{ amount: usd(0.1) }, { amount: usd(0.2) }, { amount: usd(1234567.89) }]
		expect(run('sum(fields.items.amount)', { items: rows })).toEqual({ amount: '1234568.19', currency: 'USD' })
	})

	it('fails a mixed-currency sum naming the currencies found', () => {
		const rows = [{ amount: usd(5) }, { amount: { amount: 3, currency: 'EUR' } }]
		const r = failure('sum(fields.items.amount)', { items: rows })
		expect(r.code).toBe('currency-mismatch')
		expect(r.error).toContain('EUR, USD')
		expect(failure('max(fields.items.amount)', { items: rows }).code).toBe('currency-mismatch')
	})

	it('ignores hidden rows in another currency', () => {
		const rows = [{ amount: usd(5) }, { amount: { amount: 3, currency: 'EUR' } }]
		expect(run('sum(fields.items.amount)', { items: rows }, { rowVisible: (_, [i]) => i === 0 })).toEqual({ amount: '5', currency: 'USD' })
	})
})

describe('runtime failures', () => {
	it('rejects values an aggregate cannot combine', () => {
		expect(failure('sum(fields.items.kind)', { items }).code).toBe('type-error')
		expect(failure('any(fields.items.qty)', { items }).code).toBe('type-error')
		expect(failure('sum(fields.single)', { single: 4 }).code).toBe('type-error')
		expect(failure('sum([1, 2])', {}).code).toBe('type-error')
	})
})

describe('min and max over plain arguments', () => {
	it('keep comparing their arguments', () => {
		expect(run('min(3, 1, 2)', {})).toBe('1')
		expect(run('max(fields.a, fields.b)', { a: 2, b: 9 })).toBe('9')
	})

	it('skip absent arguments and are null when all are absent', () => {
		expect(run('min(fields.a, 4)', {})).toBe('4')
		expect(run('max(fields.a)', {})).toBe(null)
	})
})

describe('dependency analysis', () => {
	it('records the aggregated path and the filter path', () => {
		expect(extractReferences(parseOrThrow('sum(fields.items.amount, fields.items.taxable)')).paths).toEqual([
			'fields.items.amount',
			'fields.items.taxable',
		])
	})
})

const env = createTypeEnv({
	fields: T.object,
	'fields.items': T.array(T.object),
	'fields.items.amount': T.money,
	'fields.items.amount.amount': T.number,
	'fields.items.qty': T.number,
	'fields.items.taxable': T.boolean,
	'fields.items.kind': T.string,
	'fields.items.due': T.date,
	'fields.items.parts': T.array(T.object),
	'fields.items.parts.cost': T.number,
	'fields.scores': T.array(T.number),
	'fields.other': T.array(T.object),
	'fields.other.flag': T.boolean,
	'fields.total': T.number,
	threshold: T.number,
})

const codes = (src: string) => check(src, env).diagnostics.map((d) => d.code)
const messages = (src: string) => check(src, env).diagnostics.map((d) => d.message)

describe('checking aggregates', () => {
	it('infers each result type', () => {
		expect(check('sum(fields.items.amount)', env)).toEqual({ type: T.money, diagnostics: [] })
		expect(check('sum(fields.items.qty)', env).type).toEqual(T.number)
		expect(check('avg(fields.scores)', env).type).toEqual(T.number)
		expect(check('count(fields.items, fields.items.taxable)', env).type).toEqual(T.number)
		expect(check('min(fields.items.due)', env).type).toEqual(T.date)
		expect(check('any(fields.items.taxable)', env).type).toEqual(T.boolean)
		expect(check('sum(fields.items.parts.cost, fields.items.taxable)', env)).toEqual({ type: T.number, diagnostics: [] })
		expect(check('sum(fields.items.amount).amount > 10', env)).toEqual({ type: T.boolean, diagnostics: [] })
	})

	it('keeps min and max over plain arguments', () => {
		expect(check('min(fields.total, 3)', env)).toEqual({ type: T.number, diagnostics: [] })
	})

	it('accepts a filter that compares a row value', () => {
		expect(checkBooleanGate('count(fields.items, fields.items.kind == "other") > 0', env).diagnostics).toEqual([])
		expect(check('count(fields.items, fields.items.qty > threshold)', env).diagnostics).toEqual([])
	})

	it('rejects an aggregate over an incompatible type', () => {
		expect(codes('sum(fields.items.kind)')).toEqual(['type-mismatch'])
		expect(messages('sum(fields.items.kind)')[0]).toBe('sum needs number or money values; fields.items.kind is string')
		expect(codes('avg(fields.items.due)')).toEqual(['type-mismatch'])
		expect(codes('max(fields.items.taxable)')).toEqual(['type-mismatch'])
		expect(codes('all(fields.items.qty)')).toEqual(['type-mismatch'])
	})

	it('rejects a non-boolean filter', () => {
		expect(codes('sum(fields.items.qty, fields.items.qty)')).toEqual(['type-mismatch'])
		expect(messages('sum(fields.items.qty, fields.items.kind)')[0]).toBe('The sum filter must be boolean, got string')
	})

	it('rejects a path that is not a list', () => {
		expect(codes('sum(fields.total)')).toEqual(['invalid-aggregate'])
		expect(messages('count(fields.total)')[0]).toBe('count needs a path into a list field; fields.total is number')
		expect(codes('sum([1, 2])')).toEqual(['invalid-aggregate'])
	})

	it('rejects a filter on a different list', () => {
		expect(codes('sum(fields.items.qty, fields.other.flag)')).toContain('invalid-aggregate')
		expect(messages('sum(fields.items.qty, fields.other.flag)')).toContain(
			'The filter reads fields.other.flag from fields.other, a different list than fields.items',
		)
	})

	it('rejects a filter that does not test the rows', () => {
		expect(codes('sum(fields.items.qty, fields.total > 3)')).toEqual(['invalid-aggregate'])
	})

	it('rejects a list value read outside an aggregate', () => {
		expect(codes('fields.items.qty > 1')).toEqual(['invalid-aggregate'])
		expect(messages('fields.items.qty > 1')[0]).toBe(
			'fields.items.qty reads a value from every row of fields.items; use it inside an aggregate such as sum(fields.items.qty) or count(fields.items)',
		)
	})

	it('rejects the wrong number of arguments', () => {
		expect(codes('sum(fields.items.qty, fields.items.taxable, fields.items.taxable)')).toEqual(['arity'])
		expect(codes('count()')).toEqual(['arity'])
	})
})
