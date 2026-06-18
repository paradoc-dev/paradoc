/**
 * Built-in function implementations, keyed by the same names the registry
 * declares. The evaluator dispatches here; the party/witness domain functions
 * are NOT here (they are host-injected via the context). A conformance test
 * asserts these keys match the registry's non-domain functions exactly.
 */

import { Decimal } from '../decimal/decimal'
import { EvaluationError } from './errors'
import { addDays, addDuration, dateDiff, yearsBetween } from './temporal'
import { NULL, Values, valueEquals, type Value } from './values'
import type { EvaluationContext } from './context'

export type Impl = (args: readonly Value[], ctx: EvaluationContext) => Value

function arg(args: readonly Value[], i: number): Value {
	return args[i] ?? NULL
}

function asString(v: Value, fn: string): string {
	if (v.kind === 'string') return v.value
	throw new EvaluationError('type-error', `${fn} expects a string, got ${v.kind}`)
}

function asNumber(v: Value, fn: string): Decimal {
	if (v.kind === 'number') return v.value
	throw new EvaluationError('type-error', `${fn} expects a number, got ${v.kind}`)
}

function isEmptyValue(v: Value): boolean {
	if (v.kind === 'null') return true
	if (v.kind === 'string') return v.value.length === 0
	if (v.kind === 'array') return v.value.length === 0
	return false
}

export const BUILTIN_IMPLS: Readonly<Record<string, Impl>> = {
	// --- string ---
	contains: (args) => {
		const haystack = arg(args, 0)
		const needle = arg(args, 1)
		if (haystack.kind === 'null') return Values.boolean(false)
		if (haystack.kind === 'string') return Values.boolean(haystack.value.includes(asString(needle, 'contains')))
		if (haystack.kind === 'array') return Values.boolean(haystack.value.some((el) => valueEquals(el, needle)))
		throw new EvaluationError('type-error', `contains expects a string or array, got ${haystack.kind}`)
	},
	startsWith: (args) => Values.boolean(asString(arg(args, 0), 'startsWith').startsWith(asString(arg(args, 1), 'startsWith'))),
	endsWith: (args) => Values.boolean(asString(arg(args, 0), 'endsWith').endsWith(asString(arg(args, 1), 'endsWith'))),
	trim: (args) => Values.string(asString(arg(args, 0), 'trim').trim()),
	lower: (args) => Values.string(asString(arg(args, 0), 'lower').toLowerCase()),
	upper: (args) => Values.string(asString(arg(args, 0), 'upper').toUpperCase()),
	matches: (args) => {
		const value = asString(arg(args, 0), 'matches')
		const pattern = asString(arg(args, 1), 'matches')
		let re: RegExp
		try {
			re = new RegExp(pattern)
		} catch {
			throw new EvaluationError('type-error', `Invalid pattern: ${JSON.stringify(pattern)}`)
		}
		return Values.boolean(re.test(value))
	},
	isEmpty: (args) => Values.boolean(isEmptyValue(arg(args, 0))),
	isNotEmpty: (args) => Values.boolean(!isEmptyValue(arg(args, 0))),
	length: (args) => {
		const v = arg(args, 0)
		if (v.kind === 'null') return Values.num('0')
		if (v.kind === 'string') return Values.num(String(v.value.length))
		if (v.kind === 'array') return Values.num(String(v.value.length))
		throw new EvaluationError('type-error', `length expects a string or array, got ${v.kind}`)
	},
	coalesce: (args) => {
		for (const a of args) if (a.kind !== 'null') return a
		return NULL
	},

	// --- number (exact decimal) ---
	round: (args) => {
		const value = asNumber(arg(args, 0), 'round')
		const digitsArg = args[1]
		const digits = digitsArg && digitsArg.kind === 'number' ? digitsArg.value.toNumber() : 0
		return Values.number(value.round(digits))
	},
	floor: (args) => Values.number(asNumber(arg(args, 0), 'floor').floor()),
	ceil: (args) => Values.number(asNumber(arg(args, 0), 'ceil').ceil()),
	abs: (args) => Values.number(asNumber(arg(args, 0), 'abs').abs()),
	min: (args) => reduceNumbers(args, 'min', (a, b) => (a.lte(b) ? a : b)),
	max: (args) => reduceNumbers(args, 'max', (a, b) => (a.gte(b) ? a : b)),

	// --- date (today/now read the injected as-of clock) ---
	today: (_args, ctx) => {
		if (!ctx.asOf) throw new EvaluationError('missing-clock', 'today() requires an as-of date in the context')
		return Values.string(ctx.asOf.date)
	},
	now: (_args, ctx) => {
		if (!ctx.asOf) throw new EvaluationError('missing-clock', 'now() requires an as-of datetime in the context')
		return Values.string(ctx.asOf.datetime)
	},
	yearsBetween: (args) => Values.num(String(yearsBetween(asString(arg(args, 0), 'yearsBetween'), asString(arg(args, 1), 'yearsBetween')))),
	dateDiff: (args) => {
		const unitArg = args[2]
		const unit = unitArg && unitArg.kind === 'string' ? unitArg.value : undefined
		return Values.num(String(dateDiff(asString(arg(args, 0), 'dateDiff'), asString(arg(args, 1), 'dateDiff'), unit)))
	},
	addDuration: (args) => Values.string(addDuration(asString(arg(args, 0), 'addDuration'), asString(arg(args, 1), 'addDuration'))),
	addDays: (args) => Values.string(addDays(asString(arg(args, 0), 'addDays'), asNumber(arg(args, 1), 'addDays').toNumber())),
}

function reduceNumbers(args: readonly Value[], fn: string, pick: (a: Decimal, b: Decimal) => Decimal): Value {
	if (args.length === 0) throw new EvaluationError('arity', `${fn} requires at least one argument`)
	let acc = asNumber(arg(args, 0), fn)
	for (let i = 1; i < args.length; i++) acc = pick(acc, asNumber(arg(args, i), fn))
	return Values.number(acc)
}
