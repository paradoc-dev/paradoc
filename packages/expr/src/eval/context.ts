/**
 * The evaluation context: how the evaluator resolves bare references, reads the
 * host-supplied "as of" clock for `today()`/`now()`, and dispatches
 * host-injected domain functions (the party/witness predicates).
 */

import { toValue, type Value } from './values'

/** The as-of timestamps for `today()`/`now()`, stored with the submission so a
 * re-evaluation is reproducible. Never read from the wall clock. */
export interface AsOf {
	/** ISO date, `YYYY-MM-DD`. */
	readonly date: string
	/** ISO datetime. */
	readonly datetime: string
}

export type HostFunction = (args: readonly Value[]) => Value

export interface EvaluationContext {
	/** Resolve a top-level identifier (e.g. `fields`, a defs key) or undefined. */
	lookup(name: string): Value | undefined
	readonly asOf?: AsOf
	/** Host-injected functions (party/witness predicates), by name. */
	readonly hostFunctions?: Readonly<Record<string, HostFunction>>
}

export interface ContextOptions {
	readonly asOf?: AsOf
	readonly hostFunctions?: Readonly<Record<string, HostFunction>>
}

/** Build a context from a plain host data object (e.g. `{ fields, ...defs }`). */
export function createContext(data: Record<string, unknown>, opts: ContextOptions = {}): EvaluationContext {
	const root = toValue(data)
	const map = root.kind === 'object' ? root.value : new Map<string, Value>()
	return {
		lookup: (name) => map.get(name),
		asOf: opts.asOf,
		hostFunctions: opts.hostFunctions,
	}
}
