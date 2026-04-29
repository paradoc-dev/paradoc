/**
 * Logic Module
 *
 * This module is organized into two main areas:
 *
 * - **design-time/**: Form authoring tools (validation, type-checking)
 * - **runtime/**: Form execution tools (expression evaluation)
 *
 * ## Design-Time
 * Use during form authoring to validate logic expressions and check types.
 * Ensures expressions are syntactically correct and variables exist.
 *
 * ## Runtime
 * Use during form execution to evaluate expressions with actual data.
 * Determines visibility, required status, and other dynamic behaviors.
 *
 * @module logic
 */

// ============================================================================
// Design-Time API (Form Authoring)
// ============================================================================

export {
  validateLogic,
  type LogicValidatableArtifact,
  type CondExpr,
  type DefsSection,
} from './design-time'

// ============================================================================
// Runtime API (Form Execution)
// ============================================================================

export {
  evaluateFormDefs,
  evaluateRules,
  evaluateFormRules,
  type FormRuntimeState,
  type FieldRuntimeState,
  type AnnexRuntimeState,
  type RuleValidationResult,
  type FormRulesValidationResult,
  type EvaluationContext,
} from './runtime'
