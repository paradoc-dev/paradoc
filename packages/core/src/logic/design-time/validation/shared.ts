import type { CondExpr, Form, Bundle, BundleContentItem, DefsSection, Expression } from '@paradoc/types'
import type { LogicValidationIssue } from './validate-form-logic'
import { parseExpression } from './expression-parser'
import { definitionExpressionLeaves } from '../../shared/defs-dependencies'
import { isScalarExpressionType } from '../../shared/expression-types'

// ============================================================================
// Type Guards for Content Items
// ============================================================================

/**
 * Checks if a bundle content item is an inline artifact (type: 'inline').
 */
export function isInlineBundleArtifact(
  item: BundleContentItem
): item is Extract<BundleContentItem, { type: 'inline' }> {
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

  if (!parseResult.fullyStatic) {
    issues.push({
      message: 'Dynamic member access prevents complete dependency analysis',
      path,
      expression: expr,
    })
    if (!collectAllErrors) return false
  }

  // Check each variable reference
  for (const variable of parseResult.variables) {
    if (!validVariables.has(variable)) {
      issues.push({
        message: unknownVariableMessage(variable, validVariables),
        path,
        expression: expr,
        variable,
      })
      if (!collectAllErrors) return false
    }
  }

  return true
}

/**
 * Validates a single Expression (scalar or object type).
 *
 * For scalar types, validates the value expression string.
 * For object types, validates each property expression string.
 *
 * @param expr - The Expression to validate
 * @param key - The defs key name
 * @param validVariables - Set of valid variable names
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @returns true if should continue validation, false if should stop
 */
export function validateDefsExpression(
  expr: Expression,
  key: string,
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (isScalarExpressionType(expr.type)) {
    // Scalar type: value is a single expression string
    return validateExpression(
      expr.value as string,
      ['defs', key, 'value'],
      validVariables,
      issues,
      collectAllErrors
    )
  }

  // Object type: value is an object with expression strings for each property
  for (const leaf of definitionExpressionLeaves(expr.value)) {
    if (
      !validateExpression(
        leaf.expression,
        ['defs', key, 'value', ...leaf.path],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }
  }

  return true
}

/**
 * Gets the expression string for a defs key (for error reporting).
 */
export function getExpressionForKey(expr: Expression): string {
  if (isScalarExpressionType(expr.type)) {
    return expr.value as string
  }
  // For object types, show the first property expression
  return definitionExpressionLeaves(expr.value)[0]?.expression ?? '[object expression]'
}

/**
 * The diagnostic for a reference that does not resolve. A row reference used
 * where no list row encloses the expression gets a message that names the
 * contexts where it is available.
 */
export function unknownVariableMessage(variable: string, validVariables: ReadonlySet<string>): string {
  const root = variable.split('.')[0]!
  if (root === 'item' && !validVariables.has('item')) {
    return '"item" refers to the current list row and is only available in expressions inside a list item (its visible and required conditions and those of its nested fields)'
  }
  if (root === 'parent' && !validVariables.has('parent')) {
    return validVariables.has('item')
      ? '"parent" refers to the enclosing row of a nested list; this list is not nested inside another list item, so use "item" or "fields.<id>"'
      : '"parent" refers to the enclosing row of a nested list and is only available in expressions inside an item of a list nested in another list item'
  }
  return `Unknown variable: "${variable}"`
}

/**
 * Definition names reserved for context roots: `fields` and `parties`, and
 * `item` and `parent` for list rows. A computed value with one of these names
 * would replace the root it shadows.
 */
const RESERVED_DEFINITION_NAMES: ReadonlyMap<string, string> = new Map([
  ['fields', 'the form\'s field values'],
  ['parties', 'the form\'s parties'],
  ['item', 'list row references'],
  ['parent', 'list row references'],
])

/** Rejects computed values named after a context root. */
export function validateReservedDefinitionNames(
  defs: DefsSection | undefined,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!defs) return true
  for (const key of Object.keys(defs)) {
    const reservedFor = RESERVED_DEFINITION_NAMES.get(key)
    if (reservedFor === undefined) continue
    issues.push({
      message: `Computed value name "${key}" is reserved for ${reservedFor}; rename this definition`,
      path: ['defs', key],
      severity: 'error',
    })
    if (!collectAllErrors) return false
  }
  return true
}
