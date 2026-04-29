/**
 * Core expression evaluation using expr-eval-fork.
 *
 * This module provides functions for evaluating expressions at runtime
 * with actual form data.
 */

import { Parser } from 'expr-eval-fork'
import type { EvaluationContext, ExpressionResult, EvaluationOptions, PartyContextEntry } from './types'
import { ExpressionEvaluationError } from './errors'

// Singleton parser instance with member access enabled (same config as validation)
const parser = new Parser({
  allowMemberAccess: true,
})

// ============================================================================
// Party-specific functions for expression evaluation
// ============================================================================

/**
 * Get the parties array for a role from the context.
 */
function getPartiesFromContext(roleId: string, context: EvaluationContext): PartyContextEntry[] {
  return context.parties?.[roleId] ?? []
}

/**
 * partyCount(roleId) - Get the count of parties for a role.
 */
function partyCount(roleId: string, context: EvaluationContext): number {
  return getPartiesFromContext(roleId, context).length
}

/**
 * signedCount(roleId) - Get the count of signed parties for a role.
 */
function signedCount(roleId: string, context: EvaluationContext): number {
  return getPartiesFromContext(roleId, context).filter((p) => p.signed).length
}

/**
 * allSigned(roleId) - Check if all parties in a role have signed.
 */
function allSigned(roleId: string, context: EvaluationContext): boolean {
  const parties = getPartiesFromContext(roleId, context)
  if (parties.length === 0) return false
  return parties.every((p) => p.signed)
}

/**
 * anySigned(roleId) - Check if any party in a role has signed.
 */
function anySigned(roleId: string, context: EvaluationContext): boolean {
  return getPartiesFromContext(roleId, context).some((p) => p.signed)
}

/**
 * partyType(roleId) - Get the type of the first party in a role.
 */
function partyType(roleId: string, context: EvaluationContext): string {
  const parties = getPartiesFromContext(roleId, context)
  return parties[0]?.type ?? ''
}

/**
 * witnessCount() - Get the count of witnesses.
 */
function witnessCount(context: EvaluationContext): number {
  return context.witnesses?.length ?? 0
}

/**
 * allWitnessesSigned() - Check if all witnesses have signed.
 */
function allWitnessesSigned(context: EvaluationContext): boolean {
  const witnesses = context.witnesses ?? []
  if (witnesses.length === 0) return false
  return witnesses.every((w) => w.signed)
}

/**
 * anyWitnessSigned() - Check if any witness has signed.
 */
function anyWitnessSigned(context: EvaluationContext): boolean {
  return (context.witnesses ?? []).some((w) => w.signed)
}

/**
 * Creates context-bound party functions for expression evaluation.
 * These functions are curried with the context so they can be called
 * with just the roleId in expressions.
 */
function createPartyFunctions(context: EvaluationContext): Record<string, (...args: unknown[]) => unknown> {
  return {
    partyCount: (roleId: unknown) => partyCount(String(roleId), context),
    signedCount: (roleId: unknown) => signedCount(String(roleId), context),
    allSigned: (roleId: unknown) => allSigned(String(roleId), context),
    anySigned: (roleId: unknown) => anySigned(String(roleId), context),
    partyType: (roleId: unknown) => partyType(String(roleId), context),
    witnessCount: () => witnessCount(context),
    allWitnessesSigned: () => allWitnessesSigned(context),
    anyWitnessSigned: () => anyWitnessSigned(context),
  }
}

/**
 * Evaluates an expression string with the given context.
 *
 * @param expr - The expression string to evaluate
 * @param context - The evaluation context containing field values and logic keys
 * @param options - Evaluation options
 * @returns ExpressionResult with success status and evaluated value
 *
 * @example
 * ```typescript
 * const context = {
 *   fields: { age: 25 },
 *   parties: { buyer: [{ type: 'person', data: {...}, signed: true }] },
 *   isAdult: true,
 * }
 *
 * evaluateExpression('fields.age >= 18', context)
 * // { success: true, value: true }
 *
 * evaluateExpression('isAdult and fields.age > 21', context)
 * // { success: true, value: true }
 *
 * evaluateExpression('partyCount("buyer") > 0', context)
 * // { success: true, value: true }
 *
 * evaluateExpression('allSigned("buyer")', context)
 * // { success: true, value: true }
 * ```
 */
export function evaluateExpression<T = unknown>(
  expr: string,
  context: EvaluationContext,
  options?: EvaluationOptions
): ExpressionResult<T> {
  try {
    const parsed = parser.parse(expr)

    // Create extended context with party functions
    const partyFunctions = createPartyFunctions(context)
    const extendedContext = {
      ...context,
      ...partyFunctions,
    }

    // Cast to any since expr-eval-fork's type definitions are restrictive
    // but it actually handles all JavaScript values at runtime
    const value = parsed.evaluate(extendedContext as unknown as Parameters<typeof parsed.evaluate>[0]) as T
    return { success: true, value }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    if (options?.throwOnError) {
      throw ExpressionEvaluationError.evaluationFailed(expr, error)
    }
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Evaluates a conditional expression (CondExpr) which can be either
 * a boolean literal or a string expression.
 *
 * @param condExpr - The conditional expression (boolean | string | undefined)
 * @param context - The evaluation context
 * @param defaultValue - The default value to use if condExpr is undefined or evaluation fails
 * @param options - Evaluation options
 * @returns The boolean result of evaluation
 *
 * @example
 * ```typescript
 * const context = { fields: { age: { value: 25 } }, isAdult: true }
 *
 * evaluateBooleanExpression(true, context, false)
 * // true (literal)
 *
 * evaluateBooleanExpression(false, context, true)
 * // false (literal)
 *
 * evaluateBooleanExpression(undefined, context, true)
 * // true (default)
 *
 * evaluateBooleanExpression('fields.age >= 18', context, false)
 * // true (evaluated expression)
 *
 * evaluateBooleanExpression('isAdult', context, false)
 * // true (evaluated expression - direct variable reference)
 * ```
 */
export function evaluateBooleanExpression(
  condExpr: boolean | string | undefined,
  context: EvaluationContext,
  defaultValue: boolean,
  options?: EvaluationOptions
): boolean {
  // Undefined → use default
  if (condExpr === undefined) {
    return defaultValue
  }

  // Boolean literal → use directly
  if (typeof condExpr === 'boolean') {
    return condExpr
  }

  // String expression → evaluate
  const result = evaluateExpression<unknown>(condExpr, context, options)

  if (!result.success) {
    // Evaluation failed → use default
    return defaultValue
  }

  // Coerce to boolean (truthy/falsy)
  return Boolean(result.value)
}

/**
 * Evaluates an expression and returns the result or a default value.
 *
 * @param expr - The expression string to evaluate
 * @param context - The evaluation context
 * @param defaultValue - The default value if evaluation fails
 * @param options - Evaluation options
 * @returns The evaluated value or default
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
