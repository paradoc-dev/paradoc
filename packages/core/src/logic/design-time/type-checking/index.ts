/**
 * Design-time type checking (Internal).
 *
 * Builds an @paradoc/expr type environment from an artifact and validates that
 * boolean-gate expressions (required, visible, include) resolve to boolean.
 *
 * These are internal implementation details used by validateLogic(). For the
 * public API, use validateLogic() from '@paradoc/core'.
 *
 * @internal
 */

// Type definitions
export type {
  InferredPrimitiveType,
  InferredCompositeType,
  InferredType,
  TypeConfidence,
  TypeInferenceResult,
  TypeValidationSeverity,
  TypeValidationResult,
} from './inferred-types'

// The type environment is @paradoc/expr's TypeEnv; aliased for existing callers.
export type { TypeEnv as TypeEnvironment } from '@paradoc/expr'

// Environment building + circular-dependency detection
export type { TopologicalSortResult } from './build-type-environment'
export {
  topologicalSortDefsKeys,
  buildFormTypeEnvironment,
  buildBundleTypeEnvironment,
} from './build-type-environment'

// Boolean-gate type validation
export { validateBooleanType } from './validate-boolean-type'
