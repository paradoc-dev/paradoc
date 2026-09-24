/**
 * Core expression evaluation, backed by @paradoc/expr.
 *
 * This module evaluates expressions at runtime with actual form data:
 * `evaluateExpression` for a value, and `evaluateGate` for every boolean gate
 * (visibility, requiredness, row visibility, rules).
 *
 * The 8 party/witness predicates are supplied as host-injected functions, and
 * bare references resolve against the context (a missing reference resolves to
 * null, so callers need not pre-seed fields). A context value that cannot
 * become an expression value, such as NaN, fails the evaluation that reads it.
 */

import {
	evaluateExpression as runExpression,
	EvaluationError,
	Values,
	toValue,
	truthy,
	type EvaluationContext as ExprContext,
	type HostFunction,
	type Value,
	type EvalResult,
} from '@paradoc/expr'
import { EVALUATION_CLOCK, FUNCTION_REGISTRY, HOST_FUNCTIONS, PARTY_ENTRIES, ROW_ORIGINS, ROW_VISIBILITY, WITNESS_ENTRIES, type EvaluationContext, type ExpressionResult, type PartyContextEntry } from './types'
import { resolveRowListPath, type RowOrigin } from '../../shared/list-paths'

// ============================================================================
// Party-specific functions for expression evaluation
// ============================================================================

function getPartiesFromContext(roleId: string, context: EvaluationContext): PartyContextEntry[] {
	return context[PARTY_ENTRIES]?.[roleId] ?? []
}

/** partyCount(roleId) - Get the count of parties for a role. */
function partyCount(roleId: string, context: EvaluationContext): number {
	return getPartiesFromContext(roleId, context).length
}

/** signedCount(roleId) - Get the count of signed parties for a role. */
function signedCount(roleId: string, context: EvaluationContext): number {
	return getPartiesFromContext(roleId, context).filter((p) => p.signed).length
}

/** allSigned(roleId) - Check if all parties in a role have signed (false when empty). */
function allSigned(roleId: string, context: EvaluationContext): boolean {
	const parties = getPartiesFromContext(roleId, context)
	if (parties.length === 0) return false
	return parties.every((p) => p.signed)
}

/** anySigned(roleId) - Check if any party in a role has signed. */
function anySigned(roleId: string, context: EvaluationContext): boolean {
	return getPartiesFromContext(roleId, context).some((p) => p.signed)
}

/** partyType(roleId) - Get the type of the first party in a role. */
function partyType(roleId: string, context: EvaluationContext): string {
	const parties = getPartiesFromContext(roleId, context)
	return parties[0]?.type ?? ''
}

/** witnessCount() - Get the count of witnesses. */
function witnessCount(context: EvaluationContext): number {
	return context[WITNESS_ENTRIES]?.length ?? 0
}

/** allWitnessesSigned() - Check if all witnesses have signed (false when empty). */
function allWitnessesSigned(context: EvaluationContext): boolean {
	const witnesses = context[WITNESS_ENTRIES] ?? []
	if (witnesses.length === 0) return false
	return witnesses.every((w) => w.signed)
}

/** anyWitnessSigned() - Check if any witness has signed. */
function anyWitnessSigned(context: EvaluationContext): boolean {
	return (context[WITNESS_ENTRIES] ?? []).some((w) => w.signed)
}

/** Extract a role-id string argument from an @paradoc/expr call. */
function roleArg(args: readonly Value[]): string {
	const a = args[0]
	if (!a) return ''
	return a.kind === 'string' ? a.value : String(fromExpressionValue(a))
}

/**
 * Adapt the runtime EvaluationContext into an @paradoc/expr context: bare
 * references resolve against the context object, and the party/witness
 * predicates are host-injected.
 */
interface CachedContextValue {
	readonly source: unknown
	readonly value: Value
}

const convertedContexts = new WeakMap<object, Map<string, CachedContextValue>>()
const reusableEvaluationContext = Symbol('reusableEvaluationContext')

/** Mark an internally built context whose roots remain stable for one artifact evaluation. */
export function markEvaluationContextReusable(context: EvaluationContext): () => void {
	Object.defineProperty(context, reusableEvaluationContext, { value: true, configurable: true })
	return () => {
		Reflect.deleteProperty(context, reusableEvaluationContext)
		convertedContexts.delete(context)
	}
}

/** The list rows a list-item expression evaluates against. */
export interface RowReferences {
	/** The current row. */
	readonly item: unknown
	/** Whether an enclosing row exists (the list is nested in another list item). */
	readonly hasParent: boolean
	/** The enclosing row of a nested list. */
	readonly parent?: unknown
	/** Where the current row sits, so aggregates over its own lists skip hidden rows. */
	readonly itemOrigin?: RowOrigin
	/** Where the enclosing row sits. */
	readonly parentOrigin?: RowOrigin
}

/**
 * Derive a context in which `item` (and `parent`, when an enclosing row
 * exists) resolve to list rows. Converted values of a reusable base context
 * are shared, so evaluating every row does not reconvert the whole form.
 */
export function withRowReferences(context: EvaluationContext, rows: RowReferences): EvaluationContext {
	const scoped: EvaluationContext = {
		...context,
		item: rows.item,
		[ROW_ORIGINS]: { item: rows.itemOrigin, parent: rows.hasParent ? rows.parentOrigin : undefined },
	}
	if (rows.hasParent) scoped.parent = rows.parent
	if (reusableEvaluationContext in context) {
		Object.defineProperty(scoped, reusableEvaluationContext, { value: true, configurable: true })
		let shared = convertedContexts.get(context)
		if (!shared) {
			shared = new Map()
			convertedContexts.set(context, shared)
		}
		convertedContexts.set(scoped, shared)
	}
	return scoped
}

/** The @paradoc/expr context for a runtime context: its roots, predicates, clock, and row visibility. */
export function toExpressionContext(context: EvaluationContext): ExprContext {
	return buildExprContext(context)
}

function buildExprContext(context: EvaluationContext): ExprContext {
	const hostFunctions: Record<string, HostFunction> = {
		partyCount: (args) => Values.num(String(partyCount(roleArg(args), context))),
		signedCount: (args) => Values.num(String(signedCount(roleArg(args), context))),
		allSigned: (args) => Values.boolean(allSigned(roleArg(args), context)),
		anySigned: (args) => Values.boolean(anySigned(roleArg(args), context)),
		partyType: (args) => Values.string(partyType(roleArg(args), context)),
		witnessCount: () => Values.num(String(witnessCount(context))),
		allWitnessesSigned: () => Values.boolean(allWitnessesSigned(context)),
		anyWitnessSigned: () => Values.boolean(anyWitnessSigned(context)),
		...context[HOST_FUNCTIONS],
	}
	const record = context as Record<string, unknown>
	const rowVisibility = context[ROW_VISIBILITY]
	const canReuse = reusableEvaluationContext in context
	let converted = canReuse ? convertedContexts.get(context) : undefined
	if (!converted) {
		converted = new Map()
		if (canReuse) convertedContexts.set(context, converted)
	}
	const resolved = new Map<string, Value>()
	return {
		lookup: (name) => {
			if (!Object.prototype.hasOwnProperty.call(record, name)) return undefined
			const resolvedValue = resolved.get(name)
			if (resolvedValue) return resolvedValue
			const source = record[name]
			const cached = converted.get(name)
			if (cached && Object.is(cached.source, source)) {
				resolved.set(name, cached.value)
				return cached.value
			}
			const value = toContextValue(source, name)
			converted.set(name, { source, value })
			resolved.set(name, value)
			return value
		},
		hostFunctions,
		asOf: context[EVALUATION_CLOCK],
		registry: context[FUNCTION_REGISTRY],
		rowVisible: rowVisibility && ((listPath, indices) => {
			// `item.parts` is a list inside the bound row; find it from the form root.
			const resolvedRow = resolveRowListPath(listPath, indices, context[ROW_ORIGINS])
			return rowVisibility(resolvedRow.listPath, resolvedRow.indices, context)
		}),
	}
}

const internalExpressionValue = Symbol('internalExpressionValue')

interface InternalExpressionValue {
	readonly [internalExpressionValue]: Value
}

/** Preserve an expression value across an internal definition dependency edge. */
export function wrapExpressionValue(value: Value): InternalExpressionValue {
	return { [internalExpressionValue]: value }
}

function isInternalExpressionValue(value: unknown): value is InternalExpressionValue {
	return Boolean(value && typeof value === 'object' && internalExpressionValue in value)
}

/**
 * Converts a context value to an expression value. A value with no expression
 * form, such as NaN or Infinity, fails the evaluation that reads it with a
 * `type-error` naming its path; it never reads as a missing value.
 */
function toContextValue(value: unknown, path: string): Value {
	if (isInternalExpressionValue(value)) return value[internalExpressionValue]
	if (Array.isArray(value)) return Values.array(value.map((item, index) => toContextValue(item, `${path}[${index}]`)))
	if (value && typeof value === 'object') {
		return Values.object(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toContextValue(item, `${path}.${key}`)] as const))
	}
	try {
		return toValue(value)
	} catch (error) {
		throw new EvaluationError('type-error', `${path} has no expression value: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export function fromExpressionValue(v: Value): unknown {
	switch (v.kind) {
		case 'number':
			return v.value.toNumber()
		case 'string':
			return v.value
		case 'boolean':
			return v.value
		case 'null':
			return null
		case 'array':
			return v.value.map(fromExpressionValue)
		case 'object':
			return Object.fromEntries([...v.value].map(([k, val]) => [k, fromExpressionValue(val)]))
	}
}

/** Internal precision-preserving seam used while evaluating dependent definitions. */
export function evaluateExpressionValue(expr: string, context: EvaluationContext): EvalResult {
	return runExpression(expr, buildExprContext(context))
}

/**
 * Evaluates an expression string with the given context.
 *
 * @example
 * ```typescript
 * const context = buildFormContext(form, {
 *   fields: { age: 25 },
 *   parties: { buyer: { id: 'buyer-0', name: 'Ann Buyer' } },
 * })
 *
 * evaluateExpression('fields.age >= 18', context)        // { success: true, value: true }
 * evaluateExpression('partyCount("buyer") > 0', context) // { success: true, value: true }
 * ```
 */
export function evaluateExpression<T = unknown>(
	expr: string,
	context: EvaluationContext,
): ExpressionResult<T> {
	const result = runExpression(expr, buildExprContext(context))
	if (result.success) {
		return { success: true, value: fromExpressionValue(result.value) as T }
	}
	return { success: false, error: result.error, code: result.code, span: result.span }
}

/**
 * The outcome of a boolean gate: its truthiness, or that an input it reads has
 * no value yet, or that it failed with its inputs present.
 */
export type GateOutcome =
	| { readonly status: 'value'; readonly value: boolean }
	| { readonly status: 'missing' }
	| { readonly status: 'failed'; readonly error: string }

/**
 * Evaluates a boolean gate (a `visible`, `required`, or row condition, or a
 * rule). A boolean literal is its own value; an expression's value is coerced
 * with `truthy`, so an empty list or string is false. Each caller decides what
 * a missing or failed gate means.
 */
export function evaluateGate(condition: boolean | string, context: EvaluationContext): GateOutcome {
	if (typeof condition === 'boolean') return { status: 'value', value: condition }
	const result = runExpression(condition, buildExprContext(context))
	if (result.success) return { status: 'value', value: truthy(result.value) }
	if (result.code === 'missing-input') return { status: 'missing' }
	return { status: 'failed', error: result.error }
}
