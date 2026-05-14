/**
 * Type definitions for the expression type inference system.
 *
 * This module provides types for inferring the return type of expressions
 * at validation time, ensuring that expressions in boolean contexts
 * (required, visible, include) will resolve to boolean at runtime.
 */

/**
 * Primitive types that can be inferred from expressions.
 * These are the fundamental JavaScript/TypeScript types.
 */
export type InferredPrimitiveType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'

/**
 * Composite types specific to Paradoc field values.
 * These represent structured data types that fields can hold.
 */
export type InferredCompositeType =
  | 'coordinate'
  | 'money'
  | 'address'
  | 'phone'
  | 'duration'
  | 'date'

/**
 * Complete inferred type.
 * Includes primitives, composites, and 'unknown' for indeterminate types.
 */
export type InferredType = InferredPrimitiveType | InferredCompositeType | 'unknown'

/**
 * Confidence level for type inference.
 * - 'certain': We are confident about the inferred type
 * - 'unknown': Type could not be determined (external refs, unknown functions)
 */
export type TypeConfidence = 'certain' | 'unknown'

/**
 * Result of type inference for an expression.
 */
export interface TypeInferenceResult {
  /** The inferred type of the expression */
  type: InferredType
  /** Confidence level of the inference */
  confidence: TypeConfidence
  /** Optional reason explaining how the type was inferred */
  reason?: string
}

/**
 * Severity level for type validation issues.
 * - 'error': We are certain the expression returns the wrong type
 * - 'warning': We cannot verify the expression returns the expected type
 */
export type TypeValidationSeverity = 'error' | 'warning'

/**
 * Result of validating that an expression returns a specific type.
 */
export interface TypeValidationResult {
  /** Whether the type validation passed */
  valid: boolean
  /** Severity of the issue if not valid */
  severity: TypeValidationSeverity
  /** Human-readable message explaining the issue */
  message?: string
  /** The type that was expected */
  expectedType?: InferredType
  /** The type that was actually inferred */
  actualType?: InferredType
}
