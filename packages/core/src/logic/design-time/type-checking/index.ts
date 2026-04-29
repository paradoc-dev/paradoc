/**
 * Expression type inference system (Internal).
 *
 * This module provides stack-based type inference for expressions,
 * ensuring that expressions in boolean contexts (required, visible, include)
 * will resolve to boolean at runtime.
 *
 * These are internal implementation details used by validateLogic().
 * For public API, use validateLogic() from '@paradoc/core'.
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

// Field type mapping
export { FIELD_TYPE_TO_VALUE_TYPE, getFieldValueType } from './field-type-map'

// Type environment
export type { TypeEnvironment, FunctionSignature } from './type-environment'
export {
  BUILTIN_FUNCTIONS,
  createTypeEnvironment,
  getVariableType,
  getFunctionSignature,
} from './type-environment'

// Type inference
export { inferExpressionType } from './type-inferrer'

// Environment building
export type { TopologicalSortResult } from './build-type-environment'
export {
  topologicalSortDefsKeys,
  buildFormTypeEnvironment,
  buildBundleTypeEnvironment,
} from './build-type-environment'

// Boolean type validation
export { validateBooleanType } from './validate-boolean-type'
