/**
 * Runtime evaluation types.
 *
 * These types define the shape of runtime field states and evaluation contexts
 * used when evaluating conditional expressions (visible, required)
 * with actual form data.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'

/**
 * Runtime state of a single field after expression evaluation.
 */
export interface FieldRuntimeState {
  /** Field identifier (may be dot-notation for nested: 'address.street') */
  fieldId: string
  /** Whether the field is visible based on expression evaluation */
  visible: boolean
  /** Whether the field is required based on expression evaluation */
  required: boolean
  /** Whether the field is disabled based on expression evaluation */
  disabled: boolean
  /** The current field value from data payload */
  value: unknown
}

/**
 * Runtime state of an annex after expression evaluation.
 */
export interface AnnexRuntimeState {
  /** Annex identifier */
  annexId: string
  /** Whether the annex is visible */
  visible: boolean
  /** Whether the annex is required */
  required: boolean
}

/**
 * Complete evaluated state of a form.
 */
export interface FormRuntimeState {
  /** Map of field ID to runtime state */
  fields: Map<string, FieldRuntimeState>
  /** Map of annex ID to runtime state */
  annexes: Map<string, AnnexRuntimeState>
  /** Evaluated defs key values */
  defsValues: Map<string, unknown>
}

/**
 * A field value entry in the evaluation context.
 * - Scalar fields: the primitive value directly (string, number, boolean, etc.)
 * - Object fields: the structured value (e.g., { amount: 1000, currency: 'USD' })
 * - Fieldsets: a NestedFieldValues record containing child entries
 */
export type FieldValueEntry = unknown

/**
 * Record of field values, supporting nesting for fieldsets.
 */
export interface NestedFieldValues {
  [fieldId: string]: FieldValueEntry
}

/**
 * Party context entry for evaluation.
 * Used for party-related functions in expressions.
 */
export interface PartyContextEntry {
  /** Party type ('person' | 'organization') */
  type: 'person' | 'organization'
  /** Party data (full party object) */
  data: unknown
  /** Whether the party has signed */
  signed: boolean
}

/**
 * Context object passed to expression evaluation.
 * This is the shape expr-eval-fork receives.
 *
 * @example
 * ```typescript
 * const context: EvaluationContext = {
 *   fields: {
 *     age: 25,
 *     name: 'John',
 *     rent: { amount: 1000, currency: 'USD' },
 *   },
 *   parties: {
 *     buyer: [{ type: 'person', data: {...}, signed: false }],
 *     seller: [{ type: 'person', data: {...}, signed: true }],
 *   },
 *   witnesses: [{ type: 'person', data: {...}, signed: true }],
 *   isAdult: true, // defs key
 * }
 * ```
 */
export interface EvaluationContext {
  /** Field values structured as { fieldId: value } */
  fields: NestedFieldValues
  /** Party data indexed by role ID, always as arrays for consistency */
  parties?: Record<string, PartyContextEntry[]>
  /** Witness data as an array */
  witnesses?: PartyContextEntry[]
  /** Resolved defs key values (dynamic keys) */
  [defsKey: string]: unknown
}

/**
 * Options for expression evaluation.
 */
export interface EvaluationOptions {
  /** Whether to throw on evaluation errors. Default: false (returns default) */
  throwOnError?: boolean
}

/**
 * Result of evaluating a single expression.
 */
export interface ExpressionResult<T = unknown> {
  /** Whether evaluation succeeded */
  success: boolean
  /** The evaluated value if successful */
  value?: T
  /** Error message if evaluation failed */
  error?: string
}

/**
 * Issue reported during form evaluation.
 */
export interface EvaluationIssue {
  /** Human-readable message */
  message: string
  /** Path to the problematic expression */
  path: (string | number)[]
  /** The expression that failed */
  expression?: string
  /** The original error message */
  originalError?: string
}

/**
 * Result of form evaluation using StandardSchemaV1 format.
 */
export type FormEvaluationResult = StandardSchemaV1.Result<FormRuntimeState>
