import type { CondExpr, Form, Bundle, BundleContentItem } from '@paradoc/types'
import type { LogicValidationIssue } from './validate-form-logic'
import { parseExpression } from './expression-parser'

// ============================================================================
// Type Guards for Content Items
// ============================================================================

/**
 * Checks if a bundle content item is an inline artifact (type: 'inline').
 */
export function isInlineBundleArtifact(
  item: BundleContentItem
): item is { type: 'inline'; key: string; artifact: Form | Bundle } {
  return item.type === 'inline' && 'artifact' in item
}

/**
 * Checks if an artifact is a Form.
 */
export function isFormArtifact(artifact: unknown): artifact is Form {
  return (
    typeof artifact === 'object' &&
    artifact !== null &&
    'kind' in artifact &&
    artifact.kind === 'form'
  )
}

/**
 * Checks if an artifact is a Bundle.
 */
export function isBundleArtifact(artifact: unknown): artifact is Bundle {
  return (
    typeof artifact === 'object' &&
    artifact !== null &&
    'kind' in artifact &&
    artifact.kind === 'bundle'
  )
}

/**
 * Validates a single expression against a set of valid variables.
 *
 * @param expr - The expression to validate (CondExpr: boolean | string)
 * @param path - JSON path to the expression for error reporting
 * @param validVariables - Set of valid variable names
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @returns true if should continue validation, false if should stop
 */
export function validateExpression(
  expr: CondExpr | undefined,
  path: (string | number)[],
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  // Boolean or undefined - nothing to validate
  if (typeof expr !== 'string') return true

  // Parse the expression
  const parseResult = parseExpression(expr)

  // Check for syntax errors
  if (!parseResult.success) {
    issues.push({
      message: `Syntax error: ${parseResult.error}`,
      path,
      expression: expr,
    })
    return collectAllErrors
  }

  // Check each variable reference
  for (const variable of parseResult.variables) {
    if (!validVariables.has(variable)) {
      issues.push({
        message: `Unknown variable: "${variable}"`,
        path,
        expression: expr,
        variable,
      })
      if (!collectAllErrors) return false
    }
  }

  return true
}
