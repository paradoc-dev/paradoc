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
 * (coalesce) and `elementOf` (reserved for collection ops) depend on argument
 * types and are resolved by the checker.
 */
export type ReturnSpec =
	| { readonly kind: 'fixed'; readonly type: ExprType }
	| { readonly kind: 'commonOfArgs' }
	| { readonly kind: 'elementOf'; readonly arg: number }

export interface ParamSpec {
	readonly name: string
	/** Expected type; `unknown` accepts any argument. */
	readonly type: ExprType
	readonly optional?: boolean
}

export type FnCategory = 'string' | 'number' | 'date' | 'collection' | 'domain' | 'logical'

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
}

const fixed = (type: ExprType): ReturnSpec => ({ kind: 'fixed', type })

/**
 * The default registry. Collection aggregates (`any`/`all`/`none`/`sum`/`join`)
 * are intentionally absent until a repeating-group field type exists; see
 * _docs/plans/paradoc-expr/language-spec.md.
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
		deterministic: true,
	},
	{
		name: 'max',
		category: 'number',
		params: [{ name: 'value', type: T.number }],
		variadic: true,
		returns: fixed(T.number),
		deterministic: true,
	},
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
 * extensions (e.g. additional domain functions). Later entries override
 * earlier ones by name.
 */
export function buildRegistry(extra: readonly FnSignature[] = []): Registry {
	const map = new Map<string, FnSignature>()
	for (const sig of [...DEFAULT_SIGNATURES, ...extra]) {
		map.set(sig.name, sig)
	}
	return {
		signatures: map,
		has: (name) => map.has(name),
		get: (name) => map.get(name),
		names: () => [...map.keys()],
	}
}
