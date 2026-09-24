/**
 * The function registry: the single source of truth for the language's
 * callable functions. Both the evaluator and the checker read it, so the
 * design-time and runtime function vocabularies cannot drift (the class of
 * "type-checks green, throws at runtime" bug is structurally impossible).
 *
 * This module declares only SIGNATURES (names, parameter types, return types,
 * flags). The evaluator binds runtime implementations to these names; a
 * conformance test asserts the two sets are identical.
 */

import { T, type ExprType } from '../types'

/**
 * How a function's return type is determined. Most are `fixed`; `commonOfArgs`
 * (coalesce) and `aggregate` (the list aggregates, typed from the aggregated
 * path's element) depend on argument types and are resolved by the checker.
 */
export type ReturnSpec =
	| { readonly kind: 'fixed'; readonly type: ExprType }
	| { readonly kind: 'commonOfArgs' }
	| { readonly kind: 'aggregate' }

export interface ParamSpec {
	readonly name: string
	/** Expected type; `unknown` accepts any argument. */
	readonly type: ExprType
	readonly optional?: boolean
}

export type FnCategory = 'string' | 'number' | 'date' | 'collection' | 'aggregate' | 'domain' | 'logical'

export interface FnSignature {
	readonly name: string
	readonly category: FnCategory
	readonly params: readonly ParamSpec[]
	/** The final parameter may repeat (e.g. `min`, `max`, `coalesce`). */
	readonly variadic?: boolean
	readonly returns: ReturnSpec
	/**
	 * Requires host-provided context at evaluation: `today`/`now` need the
	 * as-of timestamp; the party/witness functions need the party context.
	 */
	readonly hostInjected?: boolean
	/** All registered functions must be deterministic; non-determinism is rejected. */
	readonly deterministic: boolean
	/**
	 * Evaluated over the rows of a list path with an optional same-list filter,
	 * as in `sum(fields.items.amount, fields.items.taxable)`. `min` and `max`
	 * aggregate only when their first argument is a path into a list; otherwise
	 * they compare their arguments.
	 */
	readonly aggregate?: boolean
}

const fixed = (type: ExprType): ReturnSpec => ({ kind: 'fixed', type })

/** A list aggregate: a path into a list plus an optional boolean filter over the same rows. */
const aggregate = (name: string): FnSignature => ({
	name,
	category: 'aggregate',
	params: [
		{ name: 'values', type: T.unknown },
		{ name: 'filter', type: T.boolean, optional: true },
	],
	returns: { kind: 'aggregate' },
	aggregate: true,
	deterministic: true,
})

/**
 * The default registry. List fields support indexing, `length`, and the fixed
 * aggregate set (`sum`, `count`, `min`, `max`, `avg`, `any`, `all`). There are
 * no lambdas, `map`, `filter`, or `reduce` constructs.
 */
export const DEFAULT_SIGNATURES: readonly FnSignature[] = [
	// --- string ---
	{
		name: 'contains',
		category: 'string',
		params: [
			{ name: 'haystack', type: T.unknown },
			{ name: 'needle', type: T.unknown },
		],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'startsWith',
		category: 'string',
		params: [
			{ name: 'value', type: T.string },
			{ name: 'prefix', type: T.string },
		],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'endsWith',
		category: 'string',
		params: [
			{ name: 'value', type: T.string },
			{ name: 'suffix', type: T.string },
		],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'trim',
		category: 'string',
		params: [{ name: 'value', type: T.string }],
		returns: fixed(T.string),
		deterministic: true,
	},
	{
		name: 'lower',
		category: 'string',
		params: [{ name: 'value', type: T.string }],
		returns: fixed(T.string),
		deterministic: true,
	},
	{
		name: 'upper',
		category: 'string',
		params: [{ name: 'value', type: T.string }],
		returns: fixed(T.string),
		deterministic: true,
	},
	{
		name: 'matches',
		category: 'string',
		params: [
			{ name: 'value', type: T.string },
			{ name: 'pattern', type: T.string },
		],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'isEmpty',
		category: 'string',
		params: [{ name: 'value', type: T.unknown }],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'isNotEmpty',
		category: 'string',
		params: [{ name: 'value', type: T.unknown }],
		returns: fixed(T.boolean),
		deterministic: true,
	},
	{
		name: 'length',
		category: 'string',
		params: [{ name: 'value', type: T.unknown }],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'coalesce',
		category: 'logical',
		params: [{ name: 'value', type: T.unknown }],
		variadic: true,
		returns: { kind: 'commonOfArgs' },
		deterministic: true,
	},
	// --- number (decimal-aware) ---
	{
		name: 'round',
		category: 'number',
		params: [
			{ name: 'value', type: T.number },
			{ name: 'digits', type: T.number, optional: true },
		],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'floor',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'ceil',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'abs',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'min',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		variadic: true,
		returns: fixed(T.number),
		aggregate: true,
		deterministic: true,
	},
	{
		name: 'max',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		variadic: true,
		returns: fixed(T.number),
		aggregate: true,
		deterministic: true,
	},
	// --- aggregates over list rows (min and max above also aggregate a list path) ---
	aggregate('sum'),
	aggregate('count'),
	aggregate('avg'),
	aggregate('any'),
	aggregate('all'),
	// --- date (host-injected as-of clock) ---
	{
		name: 'today',
		category: 'date',
		params: [],
		returns: fixed(T.date),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'now',
		category: 'date',
		params: [],
		returns: fixed(T.datetime),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'yearsBetween',
		category: 'date',
		params: [
			{ name: 'from', type: T.date },
			{ name: 'to', type: T.date },
		],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'dateDiff',
		category: 'date',
		params: [
			{ name: 'from', type: T.date },
			{ name: 'to', type: T.date },
			{ name: 'unit', type: T.string, optional: true },
		],
		returns: fixed(T.number),
		deterministic: true,
	},
	{
		name: 'addDuration',
		category: 'date',
		params: [
			{ name: 'date', type: T.date },
			{ name: 'duration', type: T.duration },
		],
		returns: fixed(T.date),
		deterministic: true,
	},
	{
		name: 'addDays',
		category: 'date',
		params: [
			{ name: 'date', type: T.date },
			{ name: 'days', type: T.number },
		],
		returns: fixed(T.date),
		deterministic: true,
	},
	// --- domain: party / witness (host-injected party context) ---
	{
		name: 'partyCount',
		category: 'domain',
		params: [{ name: 'roleId', type: T.string }],
		returns: fixed(T.number),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'signedCount',
		category: 'domain',
		params: [{ name: 'roleId', type: T.string }],
		returns: fixed(T.number),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'allSigned',
		category: 'domain',
		params: [{ name: 'roleId', type: T.string }],
		returns: fixed(T.boolean),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'anySigned',
		category: 'domain',
		params: [{ name: 'roleId', type: T.string }],
		returns: fixed(T.boolean),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'partyType',
		category: 'domain',
		params: [{ name: 'roleId', type: T.string }],
		returns: fixed(T.string),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'witnessCount',
		category: 'domain',
		params: [],
		returns: fixed(T.number),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'allWitnessesSigned',
		category: 'domain',
		params: [],
		returns: fixed(T.boolean),
		hostInjected: true,
		deterministic: true,
	},
	{
		name: 'anyWitnessSigned',
		category: 'domain',
		params: [],
		returns: fixed(T.boolean),
		hostInjected: true,
		deterministic: true,
	},
]

/** A resolved registry: name -> signature, with helpers. */
export interface Registry {
	readonly signatures: ReadonlyMap<string, FnSignature>
	has(name: string): boolean
	get(name: string): FnSignature | undefined
	names(): readonly string[]
}

/**
 * Build a registry from the default signatures plus any host-provided
 * extensions (e.g. additional domain functions). Builtin collisions require
 * the name in `explicitOverrides`.
 */
export interface RegistryOptions {
	/** Builtin names that the host deliberately replaces in both checking and evaluation. */
	readonly explicitOverrides?: readonly string[]
}

export function buildRegistry(extra: readonly FnSignature[] = [], options: RegistryOptions = {}): Registry {
	const map = new Map<string, FnSignature>()
	for (const sig of DEFAULT_SIGNATURES) {
		map.set(sig.name, sig)
	}
	const overrides = new Set(options.explicitOverrides ?? [])
	for (const sig of extra) {
		if (!sig.deterministic) throw new TypeError(`Function ${sig.name} must be deterministic`)
		if (map.has(sig.name) && !overrides.has(sig.name)) {
			throw new TypeError(`Function ${sig.name} collides with a builtin; declare an explicit override`)
		}
		map.set(sig.name, sig)
	}
	return {
		signatures: map,
		has: (name) => map.has(name),
		get: (name) => map.get(name),
		names: () => [...map.keys()],
	}
}

/** The registry of the default signatures alone, shared by the checker and the evaluator. */
export const DEFAULT_REGISTRY: Registry = buildRegistry()

/** The message for a call to `name` with `count` arguments, or undefined when the count fits the signature. */
export function arityMismatch(name: string, sig: FnSignature, count: number): string | undefined {
	const required = sig.params.filter((param) => !param.optional).length
	const maximum = sig.variadic ? Infinity : sig.params.length
	if (count >= required && count <= maximum) return undefined
	const expected = maximum === Infinity
		? `at least ${required}`
		: required === maximum ? String(required) : `${required} to ${maximum}`
	return `${name} expects ${expected} argument(s), got ${count}`
}
