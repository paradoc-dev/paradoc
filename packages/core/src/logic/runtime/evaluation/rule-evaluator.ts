/**
 * Rule Evaluator - evaluates form-level validation rules.
 *
 * Rules use @paradoc/expr expressions with a flat context where:
 * - Field values are directly accessible: `ssn` instead of `fields.ssn`
 * - Defs values are accessible by name: `isIndividual`
 * - Everything else the form context carries is available: `fields.ssn`,
 *   `today()`, configured host functions, and the party predicates
 */

import type { Form, ValidationRule, RulesSection, RuleSeverity } from '@paradoc/types'
import { evaluateGate } from './expression-evaluator'
import type { EvaluationContext } from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of evaluating a single validation rule.
 */
export interface RuleValidationResult {
  /** Rule identifier */
  ruleId: string
  /** Whether the rule passed (expression evaluated to true) */
  passed: boolean
  /** Error message (only present if rule failed) */
  message?: string
  /** Severity level */
  severity: RuleSeverity
}

/**
 * Result of evaluating all form validation rules.
 */
export interface FormRulesValidationResult {
  /** True if all error-severity rules passed (warnings don't block) */
  valid: boolean
  /** All rule results */
  rules: RuleValidationResult[]
  /** Failed rules with severity 'error' */
  errors: RuleValidationResult[]
  /** Failed rules with severity 'warning' */
  warnings: RuleValidationResult[]
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Builds a flat context for rule evaluation.
 *
 * Rules read everything the form's other expressions read, since the context
 * is the full form context: `fields`, `parties`, defs values, the clock, host
 * functions and their registry, the signing state, and row visibility. On top
 * of it, each field value is also readable by its bare id (`ssn` as well as
 * `fields.ssn`); a context root or defs key of the same name wins.
 *
 * @param fieldValues - Field values from the form (flat Record<string, unknown>)
 * @param defsValues - Evaluated defs section values
 * @param fullContext - Full evaluation context of the form
 * @returns Flat context for rule expression evaluation
 */
export function buildRuleContext(
  fieldValues: Record<string, unknown>,
  defsValues: Map<string, unknown>,
  fullContext: EvaluationContext
): EvaluationContext {
  // Object.assign copies the symbol-keyed settings and signing state too.
  return Object.assign({}, fieldValues, fullContext, Object.fromEntries(defsValues))
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Evaluates a single validation rule.
 *
 * @param ruleId - Rule identifier
 * @param rule - The validation rule to evaluate
 * @param context - Flat context for expression evaluation
 * @returns RuleValidationResult
 */
export function evaluateRule(
  ruleId: string,
  rule: ValidationRule,
  context: EvaluationContext
): RuleValidationResult {
  const severity = rule.severity ?? 'error'
  const outcome = evaluateGate(rule.expr, context)

  // A rule over inputs with no value yet is not yet met, the same as a
  // comparison against an unanswered field: it fails with its own message.
  if (outcome.status === 'missing') {
    return { ruleId, passed: false, message: rule.message, severity }
  }

  if (outcome.status === 'failed') {
    return {
      ruleId,
      passed: false,
      message: `Rule expression error: ${outcome.error}`,
      severity,
    }
  }

  const passed = outcome.value

  return {
    ruleId,
    passed,
    ...(passed ? {} : { message: rule.message }),
    severity,
  }
}

/**
 * Evaluates all validation rules for a form.
 *
 * @param rules - Rules section from the form definition
 * @param fieldValues - Field values (flat Record<string, unknown>)
 * @param defsValues - Evaluated defs section values
 * @param fullContext - Full evaluation context of the form
 * @returns FormRulesValidationResult
 */
export function evaluateRules(
  rules: RulesSection | undefined,
  fieldValues: Record<string, unknown>,
  defsValues: Map<string, unknown>,
  fullContext: EvaluationContext
): FormRulesValidationResult {
  // No rules = valid
  if (!rules || Object.keys(rules).length === 0) {
    return {
      valid: true,
      rules: [],
      errors: [],
      warnings: [],
    }
  }

  // Build flat context for rule evaluation
  const context = buildRuleContext(fieldValues, defsValues, fullContext)

  // Evaluate each rule
  const results: RuleValidationResult[] = []
  for (const [ruleId, rule] of Object.entries(rules)) {
    results.push(evaluateRule(ruleId, rule, context))
  }

  // Separate errors and warnings
  const errors = results.filter((r) => !r.passed && r.severity === 'error')
  const warnings = results.filter((r) => !r.passed && r.severity === 'warning')

  return {
    valid: errors.length === 0,
    rules: results,
    errors,
    warnings,
  }
}

/**
 * Evaluates a form's rules. A field with no value reads as null.
 *
 * @param form - The form definition
 * @param fieldValues - Field values (flat Record<string, unknown>)
 * @param defsValues - Evaluated defs section values
 * @param fullContext - Full evaluation context
 * @returns FormRulesValidationResult
 */
export function evaluateFormRules(
  form: Form,
  fieldValues: Record<string, unknown>,
  defsValues: Map<string, unknown>,
  fullContext: EvaluationContext
): FormRulesValidationResult {
  return evaluateRules(form.rules, fieldValues, defsValues, fullContext)
}
