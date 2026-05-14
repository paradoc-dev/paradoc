/**
 * Test-only evaluation helper functions.
 *
 * These functions are used for granular unit testing of evaluation logic
 * but are not part of the public API or production runtime.
 */

import type { Form } from '@paradoc/types'
import type {
  EvaluationContext,
  NestedFieldValues,
  FieldRuntimeState,
  AnnexRuntimeState,
} from '@/logic/runtime/evaluation/types'
import { evaluateExpression, evaluateFormDefs } from '@/logic/runtime/evaluation'
import type { FormDataPayload } from '@/logic/runtime/evaluation/context-builder'

// ============================================================================
// Expression Evaluator Helpers
// ============================================================================

/**
 * Type guard for CondExpr (boolean | string).
 */
export function isCondExpr(value: unknown): value is boolean | string {
  return typeof value === 'boolean' || typeof value === 'string'
}

/**
 * Safely evaluates multiple expressions and collects any errors.
 *
 * @param expressions - Map of expression name to expression string
 * @param context - The evaluation context
 * @returns Object with results and any errors encountered
 */
export function evaluateMultipleExpressions(
  expressions: Record<string, string>,
  context: EvaluationContext
): {
  results: Record<string, unknown>
  errors: Array<{ key: string; expression: string; error: string }>
} {
  const results: Record<string, unknown> = {}
  const errors: Array<{ key: string; expression: string; error: string }> = []

  for (const [key, expr] of Object.entries(expressions)) {
    const result = evaluateExpression(expr, context)
    if (result.success) {
      results[key] = result.value
    } else {
      errors.push({
        key,
        expression: expr,
        error: result.error ?? 'Unknown error',
      })
    }
  }

  return { results, errors }
}

// ============================================================================
// Context Builder Helpers
// ============================================================================

/**
 * Gets the defs values map from a form and data.
 *
 * This is useful when you need access to the evaluated defs values
 * as a Map for iteration or checking specific keys.
 *
 * @param form - The Form artifact
 * @param data - The data payload
 * @returns Map of defs key → evaluated value
 */
export function getDefsValues(form: Form, data: FormDataPayload): Map<string, unknown> {
  const result = evaluateFormDefs(form, data)
  if ('value' in result) {
    const defsValues = new Map<string, unknown>()
    if (form.defs) {
      for (const key of Object.keys(form.defs)) {
        defsValues.set(key, result.value.defsValues.get(key))
      }
    }
    return defsValues
  }
  return new Map()
}

/**
 * Gets the value at a field path from structured fields context.
 *
 * @param fields - The fields context structure
 * @param path - Dot-notation path (e.g., 'address.street')
 * @returns The value at the path, or undefined if not found
 */
export function getFieldValueFromContext(fields: NestedFieldValues, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = fields

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

// ============================================================================
// Form Evaluator Helpers
// ============================================================================

/**
 * Convenience function to get just the field states.
 *
 * @param form - The Form artifact
 * @param data - The data payload
 * @returns Map of fieldId → FieldRuntimeState, or empty map on error
 */
export function evaluateFieldStates(form: Form, data: FormDataPayload): Map<string, FieldRuntimeState> {
  const result = evaluateFormDefs(form, data)
  if ('value' in result) {
    return result.value.fields
  }
  return new Map()
}

/**
 * Convenience function to get just the annex states.
 *
 * @param form - The Form artifact
 * @param data - The data payload
 * @returns Map of annexId → AnnexRuntimeState, or empty map on error
 */
export function evaluateAnnexStates(form: Form, data: FormDataPayload): Map<string, AnnexRuntimeState> {
  const result = evaluateFormDefs(form, data)
  if ('value' in result) {
    return result.value.annexes
  }
  return new Map()
}

/**
 * Gets the runtime state for a specific field.
 *
 * @param form - The Form artifact
 * @param data - The data payload
 * @param fieldId - The field ID (supports dot-notation for nested fields)
 * @returns FieldRuntimeState or undefined if not found
 */
export function getFieldRuntimeState(
  form: Form,
  data: FormDataPayload,
  fieldId: string
): FieldRuntimeState | undefined {
  const result = evaluateFormDefs(form, data)
  if ('value' in result) {
    return result.value.fields.get(fieldId)
  }
  return undefined
}

/**
 * Gets the runtime state for a specific annex.
 *
 * @param form - The Form artifact
 * @param data - The data payload
 * @param annexId - The annex ID
 * @returns AnnexRuntimeState or undefined if not found
 */
export function getAnnexRuntimeState(
  form: Form,
  data: FormDataPayload,
  annexId: string
): AnnexRuntimeState | undefined {
  const result = evaluateFormDefs(form, data)
  if ('value' in result) {
    return result.value.annexes.get(annexId)
  }
  return undefined
}
