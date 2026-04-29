/**
 * Rule Evaluator - evaluates form-level validation rules.
 *
 * Rules use expr-eval-fork expressions with a flat context where:
 * - Field values are directly accessible: `ssn` instead of `fields.ssn`
 * - Defs values are accessible by name: `isIndividual`
 * - Party functions are available: `partyCount("buyer")`
 */

import type { Form, ValidationRule, RulesSection, RuleSeverity } from '@paradoc/types'
import { evaluateExpression } from './expression-evaluator'
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
 * Unlike the full EvaluationContext which has nested `fields.fieldId`,
 * this creates a flat context where field values are directly accessible:
 * - Field values: `ssn`, `ein`, `taxClassification`
 * - Defs values: `isIndividual`, `formattedTIN`
 * - Party functions: `partyCount`, `allSigned`, etc.
 *
 * @param fieldValues - Field values from the form (flat Record<string, unknown>)
 * @param defsValues - Evaluated defs section values
 * @param fullContext - Full evaluation context (for party functions)
 * @returns Flat context for rule expression evaluation
 */
export function buildRuleContext(
  fieldValues: Record<string, unknown>,
  defsValues: Map<string, unknown>,
  fullContext: EvaluationContext
): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  // Add field values directly (flattened)
  for (const [fieldId, value] of Object.entries(fieldValues)) {
    context[fieldId] = value
  }

  // Add defs values
  for (const [key, value] of defsValues) {
    context[key] = value
  }

  // Add parties and witnesses for party functions
  context.parties = fullContext.parties
  context.witnesses = fullContext.witnesses

  // Also add the full fields context so rules can use either syntax:
  // - Flat: `ssn` (direct field name)
  // - Qualified: `fields.ssn` (with fields prefix)
  context.fields = fullContext.fields

  return context
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
  context: Record<string, unknown>
): RuleValidationResult {
  const severity = rule.severity ?? 'error'

  // Evaluate the expression
  const result = evaluateExpression<unknown>(rule.expr, context as EvaluationContext)

  if (!result.success) {
    // Expression evaluation failed - treat as rule failure
    return {
      ruleId,
      passed: false,
      message: `Rule expression error: ${result.error}`,
      severity,
    }
  }

  // Coerce result to boolean
  const passed = Boolean(result.value)

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
 * @param fullContext - Full evaluation context (for party functions)
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
 * Evaluates rules for a form with convenience data extraction.
 *
 * Pre-populates all form-defined fields in the context so that missing
 * optional fields resolve to `null` (falsy) rather than throwing
 * "undefined variable" errors in expr-eval-fork.
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
  // Ensure all form-defined fields exist in the context.
  // Missing fields get null (falsy) so rule expressions like "ssn or ein"
  // evaluate correctly when only one is provided.
  const allFieldValues: Record<string, unknown> = {}
  if (form.fields) {
    for (const fieldId of Object.keys(form.fields)) {
      allFieldValues[fieldId] = null
    }
  }
  Object.assign(allFieldValues, fieldValues)

  return evaluateRules(form.rules, allFieldValues, defsValues, fullContext)
}
