/**
 * Validates that expressions return boolean type.
 *
 * This module provides validation for expressions used in boolean contexts
 * (required, visible, include) to ensure they will resolve to boolean at runtime.
 */

import type { InferredType, TypeValidationResult } from './inferred-types'
import type { TypeEnvironment } from './type-environment'
import { inferExpressionType } from './type-inferrer'

/**
 * Validates that an expression returns a boolean type.
 *
 * @param expression - The expression string to validate
 * @param environment - Type environment with variable and function types
 * @returns TypeValidationResult indicating whether the expression returns boolean
 *
 * @example
 * ```typescript
 * const env = buildFormTypeEnvironment(form)
 *
 * // Valid: comparison returns boolean
 * validateBooleanType('fields.age >= 18', env)
 * // { valid: true, severity: 'warning' }
 *
 * // Invalid: arithmetic returns number
 * validateBooleanType('fields.age + 10', env)
 * // { valid: false, severity: 'error', message: '...', actualType: 'number' }
 *
 * // Unknown: cannot determine type
 * validateBooleanType('externalVar', env)
 * // { valid: false, severity: 'warning', message: '...', actualType: 'unknown' }
 * ```
 */
export function validateBooleanType(
  expression: string,
  environment: TypeEnvironment
): TypeValidationResult {
  const result = inferExpressionType(expression, environment)

  // If the type is boolean, validation passes
  if (result.type === 'boolean') {
    return {
      valid: true,
      severity: 'warning', // Severity is not relevant for valid results
    }
  }

  // If we're certain about the type and it's not boolean, it's an error
  if (result.confidence === 'certain') {
    return {
      valid: false,
      severity: 'error',
      message: `Expression must return boolean, but returns ${formatType(result.type)}`,
      expectedType: 'boolean',
      actualType: result.type,
    }
  }

  // If the type is unknown, it's a warning
  return {
    valid: false,
    severity: 'warning',
    message: `Cannot verify expression returns boolean${result.reason ? `: ${result.reason}` : ''}`,
    expectedType: 'boolean',
    actualType: result.type,
  }
}

/**
 * Formats a type for display in error messages.
 */
function formatType(type: InferredType): string {
  switch (type) {
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    case 'null':
      return 'null'
    case 'coordinate':
      return 'coordinate'
    case 'money':
      return 'money'
    case 'address':
      return 'address'
    case 'phone':
      return 'phone'
    case 'duration':
      return 'duration'
    case 'date':
      return 'date'
    case 'unknown':
      return 'unknown'
    default:
      return String(type)
  }
}
