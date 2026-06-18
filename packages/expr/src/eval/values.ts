/**
 * Runtime values. The evaluator works over this tagged union. Money is just an
 * `object` with `amount` (number) and `currency` (string); temporal values are
 * ISO strings. Neither needs a dedicated runtime kind: the type system tracks
 * those distinctions, and the date functions parse the strings as needed.
 */

import { Decimal } from '../decimal/decimal'

export type Value =
	| { readonly kind: 'number'; readonly value: Decimal }
	| { readonly kind: 'string'; readonly value: string }
	| { readonly kind: 'boolean'; readonly value: boolean }
	| { readonly kind: 'null' }
	| { readonly kind: 'array'; readonly value: readonly Value[] }
	| { readonly kind: 'object'; readonly value: ReadonlyMap<string, Value> }

export const NULL: Value = { kind: 'null' }

export const Values = {
	number: (d: Decimal): Value => ({ kind: 'number', value: d }),
	num: (s: string): Value => ({ kind: 'number', value: Decimal.fromString(s) }),
	string: (s: string): Value => ({ kind: 'string', value: s }),
	boolean: (b: boolean): Value => ({ kind: 'boolean', value: b }),
	null: NULL,
	array: (v: readonly Value[]): Value => ({ kind: 'array', value: v }),
	object: (entries: Iterable<readonly [string, Value]>): Value => ({
		kind: 'object',
		value: new Map(entries),
	}),
} as const

/** Render a finite JS number as an exact decimal string, avoiding exponentials. */
function numberToDecimalString(n: number): string {
	if (!Number.isFinite(n)) throw new RangeError('Cannot convert a non-finite number')
	if (Number.isInteger(n)) return n.toString()
	const s = n.toString()
	if (s.includes('e') || s.includes('E')) {
		return n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '')
	}
	return s
}

/**
 * Coerce a plain host JS value into a `Value`. Numbers become exact decimals;
 * objects and arrays convert deeply. Money/temporal are not auto-detected (a
 * money field arrives as `{ amount, currency }`, a date as an ISO string).
 */
export function toValue(js: unknown): Value {
	if (js === null || js === undefined) return NULL
	switch (typeof js) {
		case 'boolean':
			return Values.boolean(js)
		case 'number':
			return Values.number(Decimal.fromString(numberToDecimalString(js)))
		case 'bigint':
			return Values.number(Decimal.fromInt(js))
		case 'string':
			return Values.string(js)
		case 'object': {
			if (Array.isArray(js)) return Values.array(js.map(toValue))
			const entries: [string, Value][] = []
			for (const [k, v] of Object.entries(js as Record<string, unknown>)) {
				entries.push([k, toValue(v)])
			}
			return Values.object(entries)
		}
		default:
			return NULL
	}
}

/** Boolean coercion for gate contexts and ternary/logical tests. */
export function truthy(v: Value): boolean {
	switch (v.kind) {
		case 'null':
			return false
		case 'boolean':
			return v.value
		case 'number':
			return !v.value.isZero()
		case 'string':
			return v.value.length > 0
		case 'array':
			return v.value.length > 0
		case 'object':
			return true
	}
}

/** String rendering, used by polymorphic `+` concatenation and display. */
export function valueToString(v: Value): string {
	switch (v.kind) {
		case 'null':
			return ''
		case 'boolean':
			return v.value ? 'true' : 'false'
		case 'number':
			return v.value.toString()
		case 'string':
			return v.value
		case 'array':
			return v.value.map(valueToString).join(',')
		case 'object':
			return '[object]'
	}
}

/** Equality for `==` / `!=`. No cross-type coercion: `'1' != 1`. */
export function valueEquals(a: Value, b: Value): boolean {
	if (a.kind !== b.kind) return false
	switch (a.kind) {
		case 'null':
			return true
		case 'boolean':
			return a.value === (b as typeof a).value
		case 'string':
			return a.value === (b as typeof a).value
		case 'number':
			return a.value.eq((b as typeof a).value)
		case 'array': {
			const bv = (b as typeof a).value
			return a.value.length === bv.length && a.value.every((el, i) => valueEquals(el, bv[i]!))
		}
		case 'object': {
			const bv = (b as typeof a).value
			if (a.value.size !== bv.size) return false
			for (const [k, v] of a.value) {
				const other = bv.get(k)
				if (other === undefined || !valueEquals(v, other)) return false
			}
			return true
		}
	}
}

export function typeName(v: Value): string {
	return v.kind
}
