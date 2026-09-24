/**
 * Runtime expression evaluation module (Internal).
 *
 * `logic/index.ts` chooses the public surface: `evaluateFormDefs`,
 * `evaluateRules`, `evaluateFormRules`, `resolvePartyPayment`,
 * `buildFormContext`, and the runtime state types. The rest serves core.
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
  ExpressionResult,
  EvaluationIssue,
  FormEvaluationResult,
  PartyContextEntry,
} from './types'

// Expression evaluation
export {
  evaluateExpression,
  evaluateGate,
  type GateOutcome,
} from './expression-evaluator'

// Context building
export {
  buildFormContext,
  type FormDataPayload,
} from './context-builder'

// Signing state
export { signingStateOf, type SigningState } from './signing-state'

// Form evaluation
export {
  evaluateFormDefs,
} from './form-evaluator'

// Payment resolution
export {
  resolvePartyPayment,
  type ResolvedPayment,
} from './payment-resolver'

// Rule evaluation
export {
  evaluateRule,
  evaluateRules,
  evaluateFormRules,
  buildRuleContext,
  type RuleValidationResult,
  type FormRulesValidationResult,
} from './rule-evaluator'
