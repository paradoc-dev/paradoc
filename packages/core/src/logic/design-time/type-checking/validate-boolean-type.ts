/**
 * Validates that an expression used in a boolean gate (required, visible,
 * include) resolves to boolean, via @paradoc/expr's checkBooleanGate.
 */

import { checkBooleanGate, type ExprType, type TypeEnv } from '@paradoc/expr'
import type { InferredType, TypeValidationResult } from './inferred-types'

/** Map an @paradoc/expr type to the legacy InferredType (for messages). */
function exprTypeToInferred(t: ExprType): InferredType {
  switch (t.kind) {
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    case 'boolean':
      return 'boolean'
    case 'date':
    case 'datetime':
      return 'date'
    case 'duration':
      return 'duration'
    case 'money':
      return 'money'
    case 'object':
      return 'object'
    case 'array':
      return 'array'
    case 'null':
      return 'null'
    default:
      return 'unknown'
  }
}

/**
 * Validates that an expression returns a boolean type.
 *
 * @param expression - The expression string to validate
 * @param environment - @paradoc/expr type environment
 * @returns TypeValidationResult indicating whether the expression returns boolean
 */
export function validateBooleanType(expression: string, environment: TypeEnv): TypeValidationResult {
  const { type, diagnostics } = checkBooleanGate(expression, environment)

  if (diagnostics.length === 0) {
    return { valid: true, severity: 'warning' }
  }

  // A definite type problem (non-boolean result, or a type mismatch) is an
  // error. An unresolved reference/function or a syntax issue cannot be
  // verified, so it is a warning — unknown variables are also reported by the
  // separate syntax/variable validation pass.
  const hard = diagnostics.find((d) => d.code === 'non-boolean-gate' || d.code === 'type-mismatch')
  if (hard) {
    return {
      valid: false,
      severity: 'error',
      message: hard.message,
      expectedType: 'boolean',
      actualType: exprTypeToInferred(type),
    }
  }

  const first = diagnostics[0]!
  return {
    valid: false,
    severity: 'warning',
    message: `Cannot verify expression returns boolean: ${first.message}`,
    expectedType: 'boolean',
    actualType: 'unknown',
  }
}
