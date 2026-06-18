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
	type EvaluationContext as ExprContext,
	type HostFunction,
	type Value,
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
	return a.kind === 'string' ? a.value : String(fromValue(a))
}

/**
 * Adapt the runtime EvaluationContext into an @paradoc/expr context: bare
 * references resolve against the context object, and the party/witness
 * predicates are host-injected.
 */
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
	}
	const record = context as Record<string, unknown>
	return {
		lookup: (name) => (name in record ? toValue(record[name]) : undefined),
		hostFunctions,
	}
}

/** Convert an @paradoc/expr value back to a plain JS value for callers. */
function fromValue(v: Value): unknown {
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
			return v.value.map(fromValue)
		case 'object':
			return Object.fromEntries([...v.value].map(([k, val]) => [k, fromValue(val)]))
	}
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
		return { success: true, value: fromValue(result.value) as T }
	}
	if (options?.throwOnError) {
		throw ExpressionEvaluationError.evaluationFailed(expr, new Error(result.error))
	}
	return { success: false, error: result.error }
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
	const result = evaluateExpression<unknown>(condExpr, context, options)
	if (!result.success) {
		return defaultValue
	}
	return Boolean(result.value)
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
