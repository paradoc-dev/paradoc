/**
 * Validation Rule types for form-level validation
 */

/**
 * Severity level for validation rules.
 * - 'error': Blocks form submission (default)
 * - 'warning': Allows submission but shows warning
 */
export type RuleSeverity = 'error' | 'warning';

/**
 * A form-level validation rule.
 *
 * Rules use expr-eval-fork expressions to validate cross-field constraints.
 * The expression has direct access to field values (e.g., "ssn or ein")
 * and defs section values.
 */
export interface ValidationRule {
  /** Boolean expression that must evaluate to true for the form to be valid. */
  expr: string;
  /** Error message displayed when the rule fails (expression evaluates to false). */
  message: string;
  /** Severity level: 'error' (default) blocks submission, 'warning' allows but warns. */
  severity?: RuleSeverity;
}

/**
 * Rules section for form-level validation.
 * Keys are rule identifiers, values are validation rules.
 */
export interface RulesSection {
  [ruleId: string]: ValidationRule;
}
