/**
 * Runtime Logic Module
 *
 * Provides runtime evaluation of logic expressions with actual form data.
 * Use this module to evaluate conditional visibility, required status, and other
 * dynamic form behaviors based on user input.
 *
 * @module logic/runtime
 */

// ============================================================================
// Public API - Functions
// ============================================================================

export { evaluateFormDefs } from './evaluation'
export { evaluateRules, evaluateFormRules } from './evaluation'

// ============================================================================
// Public API - Types
// ============================================================================

export type {
  FormRuntimeState,
  FieldRuntimeState,
  AnnexRuntimeState,
  RuleValidationResult,
  FormRulesValidationResult,
  EvaluationContext,
} from './evaluation'
