/**
 * Form evaluation - evaluates all field and annex expressions in a form.
 *
 * Produces a FormRuntimeState with the evaluated visible/required
 * states for all fields and annexes.
 */

import type { Form, FormField, FieldsetField, FormAnnex } from '@paradoc/types'
import type {
  FormRuntimeState,
  FieldRuntimeState,
  AnnexRuntimeState,
  EvaluationContext,
  EvaluationIssue,
  FormEvaluationResult,
} from './types'
import { buildFormContext, type FormDataPayload } from './context-builder'
import { evaluateBooleanExpression } from './expression-evaluator'

/**
 * Default values for expression evaluation failures.
 *
 * These defaults ensure graceful degradation:
 * - visible defaults to true (show the field)
 * - required defaults to false (don't force input)
 */
const DEFAULTS = {
  visible: true,
  required: false,
} as const

/**
 * Options for form evaluation.
 */
export interface FormEvaluationOptions {
  /** Whether to throw on critical errors. Default: false */
  throwOnError?: boolean
}

/**
 * Internal result type during evaluation.
 */
interface EvaluationState {
  fields: Map<string, FieldRuntimeState>
  annexes: Map<string, AnnexRuntimeState>
  defsValues: Map<string, unknown>
  issues: EvaluationIssue[]
}

/**
 * Recursively evaluates fields including nested fieldsets.
 *
 * @param fields - Field definitions
 * @param data - Field data values
 * @param context - Evaluation context
 * @param state - Evaluation state to accumulate results
 * @param prefix - Path prefix for nested fields
 */
function evaluateFields(
  fields: Record<string, FormField> | undefined,
  data: Record<string, unknown> | undefined,
  context: EvaluationContext,
  state: EvaluationState,
  prefix: string = ''
): void {
  if (!fields) return

  for (const [fieldId, field] of Object.entries(fields)) {
    const fullId = prefix ? `${prefix}.${fieldId}` : fieldId

    // Get the field value from data
    // Note: data is already scoped to the current nesting level,
    // so we always use fieldId (not the full path) to access values
    let value: unknown = undefined
    if (data) {
      value = data[fieldId]
    }

    // Evaluate conditional expressions
    const visible = evaluateBooleanExpression(field.visible, context, DEFAULTS.visible)
    const required = evaluateBooleanExpression(field.required, context, DEFAULTS.required)

    // Create field runtime state
    // Note: disabled is not yet in the schema, so we default to false
    const fieldState: FieldRuntimeState = {
      fieldId: fullId,
      visible,
      required,
      disabled: false,
      value,
    }

    state.fields.set(fullId, fieldState)

    // Recursively handle fieldsets
    if (field.type === 'fieldset') {
      const fieldset = field as FieldsetField
      const nestedData = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

      evaluateFields(fieldset.fields, nestedData, context, state, fullId)
    }
  }
}

/**
 * Evaluates all annex expressions.
 *
 * @param annexes - Annex definitions (keyed by ID)
 * @param context - Evaluation context
 * @param state - Evaluation state to accumulate results
 */
function evaluateAnnexes(
  annexes: Record<string, FormAnnex> | undefined,
  context: EvaluationContext,
  state: EvaluationState
): void {
  if (!annexes) return

  for (const [annexId, annex] of Object.entries(annexes)) {
    // Evaluate conditional expressions
    const visible = evaluateBooleanExpression(annex.visible, context, DEFAULTS.visible)
    const required = evaluateBooleanExpression(annex.required, context, DEFAULTS.required)

    const annexState: AnnexRuntimeState = {
      annexId,
      visible,
      required,
    }

    state.annexes.set(annexId, annexState)
  }
}

/**
 * Evaluates all form expressions and produces runtime state.
 *
 * This function:
 * 1. Builds the evaluation context (field values + defs keys)
 * 2. Evaluates visible/required/disabled for each field
 * 3. Evaluates visible/required for each annex
 * 4. Returns the complete runtime state
 *
 * @param form - The Form artifact
 * @param data - The data payload with field values
 * @param options - Evaluation options
 * @returns FormEvaluationResult (StandardSchemaV1.Result format)
 *
 * @example
 * ```typescript
 * const form = {
 *   kind: 'form',
 *   name: 'test',
 *   version: '1.0',
 *   title: 'Test',
 *   fields: {
 *     age: { type: 'number' },
 *     drivingLicense: {
 *       type: 'text',
 *       visible: 'fields.age >= 18',
 *       required: 'isAdult'
 *     }
 *   },
 *   defs: {
 *     isAdult: {
 *       type: 'boolean',
 *       label: 'Adult Status',
 *       value: 'fields.age >= 18'
 *     }
 *   }
 * }
 *
 * const result = evaluateFormDefs(form, { fields: { age: 25 } })
 *
 * if ('value' in result) {
 *   const state = result.value
 *   console.log(state.fields.get('drivingLicense')?.visible) // true
 *   console.log(state.fields.get('drivingLicense')?.required) // true
 *   console.log(state.defsValues.get('isAdult')) // true
 * }
 * ```
 */
export function evaluateFormDefs(
  form: Form,
  data: FormDataPayload,
  options: FormEvaluationOptions = {}
): FormEvaluationResult {
  try {
    // Build evaluation context (includes evaluated defs keys)
    const context = buildFormContext(form, data)

    // Initialize evaluation state
    const state: EvaluationState = {
      fields: new Map(),
      annexes: new Map(),
      defsValues: new Map(),
      issues: [],
    }

    // Extract defs values from context
    if (form.defs) {
      for (const key of Object.keys(form.defs)) {
        const value = (context as Record<string, unknown>)[key]
        state.defsValues.set(key, value)
      }
    }

    // Evaluate all fields
    evaluateFields(form.fields, data.fields, context, state)

    // Evaluate all annexes
    evaluateAnnexes(form.annexes, context, state)

    // Return successful result
    const runtimeState: FormRuntimeState = {
      fields: state.fields,
      annexes: state.annexes,
      defsValues: state.defsValues,
    }

    return { value: runtimeState }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))

    if (options.throwOnError) {
      throw error
    }

    // Return error result
    return {
      issues: [
        {
          message: `Form evaluation failed: ${error.message}`,
          path: [],
        },
      ],
    }
  }
}
