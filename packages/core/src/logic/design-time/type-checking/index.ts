/**
 * Design-time type checking (Internal).
 *
 * Builds the reference types of an artifact's expressions and validates that
 * each expression returns the type its position requires.
 *
 * These are internal implementation details used by validateLogic(). For the
 * public API, use validateLogic() from '@paradoc/core'.
 *
 * @internal
 */

export type { TypeValidationResult } from './validate-boolean-type'

// Reference types + circular-dependency detection
export type { TopologicalSortResult, ListRowScope } from './build-type-environment'
export {
  topologicalSortDefsKeys,
  buildFormTypeAcc,
  buildFormRuleTypeAcc,
  buildBundleTypeAcc,
  enterListRow,
  isRowReferencePath,
  rowScopeTypes,
  withRowScopeTypes,
} from './build-type-environment'

// Expression type validation
export { validateBooleanType, validateExpressionType } from './validate-boolean-type'
