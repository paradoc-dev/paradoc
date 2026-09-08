/**
 * Core expression evaluation, backed by @paradoc/expr.
 *
 * This module evaluates expressions at runtime with actual form data. It keeps
 * the existing function signatures (`evaluateExpression`,
 * `evaluateBooleanExpression`, `evaluateExpressionOrDefault`) so all callers are
 * unaffected; only the engine underneath changed (from expr-eval-fork to the
 * purpose-built @paradoc/expr).
 *
 * The 8 party/witness predicates are supplied as host-injected functions, and
 * bare references resolve against the context (a missing reference degrades to
 * null rather than throwing, so callers no longer need to pre-seed fields).
 */

import {
	evaluateExpression as runExpression,
	Values,
	toValue,
	truthy,
	type EvaluationContext as ExprContext,
	type HostFunction,
	type Value,
	type EvalResult,
} from '@paradoc/expr'
import type { EvaluationContext, ExpressionResult, EvaluationOptions, PartyContextEntry } from './types'
import { ExpressionEvaluationError } from './errors'

// ============================================================================
// Party-specific functions for expression evaluation
// ============================================================================

function getPartiesFromContext(roleId: string, context: EvaluationContext): PartyContextEntry[] {
	return context.parties?.[roleId] ?? []
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
	return context.witnesses?.length ?? 0
}

/** allWitnessesSigned() - Check if all witnesses have signed (false when empty). */
function allWitnessesSigned(context: EvaluationContext): boolean {
	const witnesses = context.witnesses ?? []
	if (witnesses.length === 0) return false
	return witnesses.every((w) => w.signed)
}

/** anyWitnessSigned() - Check if any witness has signed. */
function anyWitnessSigned(context: EvaluationContext): boolean {
	return (context.witnesses ?? []).some((w) => w.signed)
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
		...context.expressionFunctions,
	}
	const record = context as Record<string, unknown>
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
			const value = toContextValue(source)
			converted.set(name, { source, value })
			resolved.set(name, value)
			return value
		},
		hostFunctions,
		asOf: context.asOf,
		registry: context.expressionRegistry,
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

function toContextValue(value: unknown): Value {
	if (isInternalExpressionValue(value)) return value[internalExpressionValue]
	if (Array.isArray(value)) return Values.array(value.map((item) => toContextValue(item)))
	if (value && typeof value === 'object') {
		return Values.object(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
			try { return [key, toContextValue(item)] as const }
			catch { return [key, Values.null] as const }
		}))
	}
	return toValue(value)
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
 * const context = {
 *   fields: { age: 25 },
 *   parties: { buyer: [{ type: 'person', data: {...}, signed: true }] },
 *   isAdult: true,
 * }
 *
 * evaluateExpression('fields.age >= 18', context)        // { success: true, value: true }
 * evaluateExpression('partyCount("buyer") > 0', context) // { success: true, value: true }
 * ```
 */
export function evaluateExpression<T = unknown>(
	expr: string,
	context: EvaluationContext,
	options?: EvaluationOptions
): ExpressionResult<T> {
	const result = runExpression(expr, buildExprContext(context))
	if (result.success) {
		return { success: true, value: fromExpressionValue(result.value) as T }
	}
	if (options?.throwOnError) {
		throw ExpressionEvaluationError.evaluationFailed(expr, new Error(result.error))
	}
	return { success: false, error: result.error, code: result.code, span: result.span }
}

/**
 * Evaluates a conditional expression (CondExpr), either a boolean literal or a
 * string expression, returning `defaultValue` when undefined or on failure.
 */
export function evaluateBooleanExpression(
	condExpr: boolean | string | undefined,
	context: EvaluationContext,
	defaultValue: boolean,
	options?: EvaluationOptions
): boolean {
	if (condExpr === undefined) {
		return defaultValue
	}
	if (typeof condExpr === 'boolean') {
		return condExpr
	}
	const result = runExpression(condExpr, buildExprContext(context))
	if (!result.success) {
		if (options?.throwOnError) throw ExpressionEvaluationError.evaluationFailed(condExpr, new Error(result.error))
		return defaultValue
	}
	return truthy(result.value)
}

/**
 * Evaluates an expression and returns the result or a default value.
 */
export function evaluateExpressionOrDefault<T>(
	expr: string,
	context: EvaluationContext,
	defaultValue: T,
	options?: EvaluationOptions
): T {
	const result = evaluateExpression<T>(expr, context, options)
	return result.success ? (result.value as T) : defaultValue
}
