/**
 * List aggregates: `sum`, `count`, `min`, `max`, `avg`, `any`, and `all` over
 * a path into a list, with an optional filter over the same rows.
 *
 * The aggregated argument is read as a path, not evaluated as a value: each
 * list the path passes through contributes its rows, so `fields.items.amount`
 * collects one amount per item and `fields.items.parts.cost` one cost per part
 * of every item. Rows the host reports hidden are skipped. While the filter is
 * evaluated for a collected value, every list path above it is bound to the row
 * it came from, so `fields.items.taxable` in the filter reads that row's flag.
 */

import type { Call, Expr } from '../ast/nodes'
import { staticPath } from '../ast/paths'
import { Decimal } from '../decimal/decimal'
import type { EvaluationContext } from './context'
import { EvaluationError } from './errors'
import { NULL, Values, truthy, type Value } from './values'
import { datetimeEpoch } from './temporal'

export const AGGREGATE_NAMES = ['sum', 'count', 'min', 'max', 'avg', 'any', 'all'] as const
export type AggregateName = (typeof AGGREGATE_NAMES)[number]

const AGGREGATE_SET: ReadonlySet<string> = new Set(AGGREGATE_NAMES)

export function isAggregateName(name: string): name is AggregateName {
	return AGGREGATE_SET.has(name)
}

/** One bound row: its value and its position at every list level from the root. */
interface RowBinding {
	readonly row: Value
	readonly indices: readonly number[]
}

type RowScope = ReadonlyMap<string, RowBinding>

const ROW_SCOPE = Symbol('rowScope')

interface ScopedContext extends EvaluationContext {
	readonly [ROW_SCOPE]?: RowScope
}

function scopeOf(ctx: EvaluationContext): RowScope | undefined {
	return (ctx as ScopedContext)[ROW_SCOPE]
}

function withScope(ctx: EvaluationContext, scope: RowScope): EvaluationContext {
	return { ...ctx, [ROW_SCOPE]: scope } as ScopedContext
}

/** The longest bound list that is a proper prefix of `segments`, with its length. */
function boundPrefix(segments: readonly string[], scope: RowScope | undefined): { binding: RowBinding; length: number } | undefined {
	if (!scope || scope.size === 0) return undefined
	for (let length = segments.length - 1; length >= 1; length--) {
		const binding = scope.get(segments.slice(0, length).join('.'))
		if (binding) return { binding, length }
	}
	return undefined
}

function member(value: Value, property: string): Value {
	return value.kind === 'object' ? value.value.get(property) ?? NULL : NULL
}

/**
 * Resolve a member path against the row bound by an enclosing aggregate, or
 * undefined when no bound list is a prefix of it.
 */
export function resolveScopedMember(node: Expr, ctx: EvaluationContext): Value | undefined {
	const scope = scopeOf(ctx)
	if (!scope || scope.size === 0) return undefined
	const path = staticPath(node)
	if (path === null) return undefined
	const segments = path.split('.')
	const bound = boundPrefix(segments, scope)
	if (!bound) return undefined
	let value = bound.binding.row
	for (const segment of segments.slice(bound.length)) value = member(value, segment)
	return value
}

/** A value collected from the aggregated path, with the rows it came from. */
interface Collected {
	readonly value: Value
	readonly scope: Map<string, RowBinding>
	readonly indices: readonly number[]
}

interface Collection {
	readonly entries: readonly Collected[]
	/** Whether the path passed through at least one list. */
	readonly throughList: boolean
}

function expandRows(entry: Collected, listPath: string, rows: readonly Value[], ctx: EvaluationContext, out: Collected[]): void {
	rows.forEach((row, index) => {
		const indices = [...entry.indices, index]
		if (ctx.rowVisible && !ctx.rowVisible(listPath, indices)) return
		const scope = new Map(entry.scope)
		scope.set(listPath, { row, indices })
		out.push({ value: row, scope, indices })
	})
}

/** Walk a static path, fanning out over every list it passes through. */
function collect(path: string, ctx: EvaluationContext): Collection {
	const segments = path.split('.')
	const outer = scopeOf(ctx)
	const bound = boundPrefix(segments, outer)
	let entries: Collected[] = bound
		? [{ value: bound.binding.row, scope: new Map(outer), indices: bound.binding.indices }]
		: [{ value: ctx.lookup(segments[0]!) ?? NULL, scope: new Map(outer ?? []), indices: [] }]
	let throughList = false

	for (let i = bound ? bound.length : 1; i < segments.length; i++) {
		const listPath = segments.slice(0, i).join('.')
		const next: Collected[] = []
		for (const entry of entries) {
			if (entry.value.kind === 'array') {
				throughList = true
				const rows: Collected[] = []
				expandRows(entry, listPath, entry.value.value, ctx, rows)
				for (const row of rows) next.push({ ...row, value: member(row.value, segments[i]!) })
			} else if (entry.value.kind === 'object') {
				next.push({ ...entry, value: member(entry.value, segments[i]!) })
			}
			// A missing parent contributes nothing: an absent list has no rows.
		}
		entries = next
	}

	const collected: Collected[] = []
	for (const entry of entries) {
		if (entry.value.kind === 'array') {
			throughList = true
			expandRows(entry, path, entry.value.value, ctx, collected)
		} else {
			collected.push(entry)
		}
	}
	return { entries: collected, throughList }
}

type Evaluate = (node: Expr, ctx: EvaluationContext) => Value

interface Money {
	readonly amount: Decimal
	readonly currency: string
}

function asMoney(value: Value): Money | undefined {
	if (value.kind !== 'object') return undefined
	const amount = value.value.get('amount')
	const currency = value.value.get('currency')
	if (amount?.kind !== 'number' || currency?.kind !== 'string') return undefined
	return { amount: amount.value, currency: currency.value }
}

function money(amount: Decimal, currency: string): Value {
	return Values.object([['amount', Values.number(amount)], ['currency', Values.string(currency)]])
}

/** Numbers stay numbers; money values must share one currency. */
type Amounts =
	| { readonly kind: 'number'; readonly values: readonly Decimal[] }
	| { readonly kind: 'money'; readonly values: readonly Decimal[]; readonly currency: string }

function amountsOf(name: AggregateName, values: readonly Value[]): Amounts {
	const numbers: Decimal[] = []
	const moneys: Money[] = []
	for (const value of values) {
		if (value.kind === 'number') {
			numbers.push(value.value)
			continue
		}
		const m = asMoney(value)
		if (!m) throw new EvaluationError('type-error', `${name} needs number or money values, got ${value.kind}`)
		moneys.push(m)
	}
	if (numbers.length > 0 && moneys.length > 0) {
		throw new EvaluationError('type-error', `${name} cannot combine numbers and money values`)
	}
	if (moneys.length === 0) return { kind: 'number', values: numbers }
	const currencies = [...new Set(moneys.map((m) => m.currency))].sort()
	if (currencies.length > 1) {
		throw new EvaluationError('currency-mismatch', `${name} found more than one currency: ${currencies.join(', ')}`)
	}
	return { kind: 'money', values: moneys.map((m) => m.amount), currency: currencies[0]! }
}

function wrap(amounts: Amounts, amount: Decimal): Value {
	return amounts.kind === 'money' ? money(amount, amounts.currency) : Values.number(amount)
}

function total(values: readonly Decimal[]): Decimal {
	return values.reduce((acc, value) => acc.add(value), Decimal.ZERO)
}

/** Order two values of one comparable kind: numbers, money of one currency, or ISO temporal strings. */
function extreme(name: 'min' | 'max', values: readonly Value[]): Value {
	if (values.length === 0) return NULL
	if (values.every((value) => value.kind === 'string')) {
		const strings = values as Extract<Value, { kind: 'string' }>[]
		const epochs = strings.map((value) => datetimeEpoch(value.value))
		const allTemporal = epochs.every((epoch) => epoch !== undefined)
		let best = strings[0]!
		let bestEpoch = epochs[0]
		for (let i = 1; i < strings.length; i++) {
			const value = strings[i]!
			const isBetter = allTemporal
				? name === 'min' ? epochs[i]! < bestEpoch! : epochs[i]! > bestEpoch!
				: name === 'min' ? value.value < best.value : value.value > best.value
			if (isBetter) {
				best = value
				bestEpoch = epochs[i]
			}
		}
		return best
	}
	const amounts = amountsOf(name, values)
	let best = amounts.values[0]!
	for (const value of amounts.values.slice(1)) {
		if (name === 'min' ? value.lt(best) : value.gt(best)) best = value
	}
	return wrap(amounts, best)
}

function booleans(name: 'any' | 'all', values: readonly Value[]): boolean[] {
	return values.map((value) => {
		if (value.kind === 'boolean') return value.value
		if (value.kind === 'null') return false
		throw new EvaluationError('type-error', `${name} needs boolean values, got ${value.kind}`)
	})
}

function reduce(name: AggregateName, included: readonly Value[]): Value {
	if (name === 'count') return Values.num(String(included.length))
	if (name === 'any') return Values.boolean(booleans(name, included).some(Boolean))
	if (name === 'all') return Values.boolean(booleans(name, included).every(Boolean))

	const present = included.filter((value) => value.kind !== 'null')
	if (name === 'min' || name === 'max') return extreme(name, present)
	if (present.length === 0) return name === 'sum' ? Values.num('0') : NULL
	const amounts = amountsOf(name, present)
	const sum = total(amounts.values)
	if (name === 'sum') return wrap(amounts, sum)
	return wrap(amounts, sum.div(Decimal.fromInt(amounts.values.length)))
}

/**
 * Evaluate an aggregate call. Returns undefined for `min`/`max` whose first
 * argument is not a path into a list, which the caller then evaluates as the
 * variadic comparison.
 */
export function evaluateAggregate(name: AggregateName, node: Call, ctx: EvaluationContext, evaluate: Evaluate): Value | undefined {
	const comparison = name === 'min' || name === 'max'
	const [valuesArg, filterArg] = node.args
	const path = valuesArg ? staticPath(valuesArg) : null
	if (comparison && (path === null || node.args.length > 2)) return undefined
	if (node.args.length < 1 || node.args.length > 2) {
		throw new EvaluationError('arity', `${name} expects 1 to 2 argument(s), got ${node.args.length}`, node.span)
	}
	if (path === null) {
		throw new EvaluationError('type-error', `${name} expects a path into a list, such as ${name}(fields.items.amount)`, valuesArg!.span)
	}

	const collection = collect(path, ctx)
	if (!collection.throughList) {
		if (comparison) return undefined
		const value = collection.entries[0]?.value ?? NULL
		if (value.kind !== 'null') {
			throw new EvaluationError('type-error', `${name} expects a path into a list, but ${path} is a single ${value.kind}`, valuesArg!.span)
		}
	}
	// A path that never reached a list (an absent list) has no rows at all.
	const entries = collection.throughList ? collection.entries : []

	const included = filterArg
		? entries.filter((entry) => truthy(evaluate(filterArg, withScope(ctx, entry.scope))))
		: entries
	try {
		return reduce(name, included.map((entry) => entry.value))
	} catch (error) {
		if (error instanceof EvaluationError && !error.span) throw new EvaluationError(error.code, error.message, node.span)
		throw error
	}
}
