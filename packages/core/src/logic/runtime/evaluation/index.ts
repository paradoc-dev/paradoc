/**
 * Runtime expression evaluation module (Internal).
 *
 * Most exports here are internal implementation details.
 * Public API exports only evaluateFormDefs() and runtime state types.
 *
 * @example
 * ```typescript
 * import { evaluateFormDefs } from '@paradoc/core'
 *
 * // Evaluate all form expressions at once (Public API)
 * const result = evaluateFormDefs(form, { fields: { age: 25 } })
 * if ('value' in result) {
 *   const state = result.value
 *   console.log(state.fields.get('drivingLicense')?.visible) // true
 * }
 * ```
 *
 * @internal
 */

// Types
export type {
  FieldRuntimeState,
  AnnexRuntimeState,
  FormRuntimeState,
  EvaluationContext,
  EvaluationOptions,
  ExpressionResult,
  EvaluationIssue,
  FormEvaluationResult,
  PartyContextEntry,
} from './types'

// Errors
export { ExpressionEvaluationError } from './errors'

// Expression evaluation
export {
  evaluateExpression,
  evaluateBooleanExpression,
  evaluateExpressionOrDefault,
} from './expression-evaluator'

// Context building
export {
  buildFormContext,
  type FormDataPayload,
} from './context-builder'

// Form evaluation
export {
  evaluateFormDefs,
  type FormEvaluationOptions,
} from './form-evaluator'

// Rule evaluation
export {
  evaluateRule,
  evaluateRules,
  evaluateFormRules,
  buildRuleContext,
  type RuleValidationResult,
  type FormRulesValidationResult,
} from './rule-evaluator'
