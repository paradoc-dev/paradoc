import type { CondExpr, Form, Bundle, BundleContentItem, DefsSection, Expression, ScalarExpressionType } from '@paradoc/types'
import { T, type ExprType, type TypeEnv } from '@paradoc/expr'
import { parseExpression } from './expression-parser'
import { definitionExpressionLeaves } from '../../shared/defs-dependencies'
import { isScalarExpressionType } from '../../shared/expression-types'
import { COMPLEX_TYPE_PROPERTIES } from '../../shared/complex-type-properties'
import { topologicalSortDefsKeys, validateBooleanType, validateExpressionType } from '../type-checking'

/**
 * Options for logic validation
 */
export interface LogicValidationOptions {
  /** Whether to collect all errors or stop at first. Default: true */
  collectAllErrors?: boolean
}

/**
 * A validation issue from logic validation. Every issue fails validation.
 */
export interface LogicValidationIssue {
  /** Human-readable error message */
  message: string
  /** JSON path to the expression location */
  path: (string | number)[]
  /** The full expression that failed (optional) */
  expression?: string
  /** Specific variable that was not found (optional) */
  variable?: string
  /** Expected type, as an @paradoc/expr type name (for type validation issues) */
  expectedType?: string
  /** Actual inferred type, as an @paradoc/expr type name (for type validation issues) */
  actualType?: string
}

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
    })
    if (!collectAllErrors) return false
  }
  return true
}

/**
 * Validates a definitions section: each expression's syntax and references,
 * and dependency cycles, which are errors because a definition in a cycle has
 * no value.
 *
 * @param dependencyExpressions - Each key's dependency expression, from `defsDependencyExpressions`
 * @returns true if should continue validation, false if should stop
 */
export function validateDefsSection(
  defs: DefsSection,
  dependencyExpressions: Record<string, string>,
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  for (const [key, expr] of Object.entries(defs)) {
    if (!validateDefsExpression(expr, key, validVariables, issues, collectAllErrors)) return false
  }

  const { cyclicKeys } = topologicalSortDefsKeys(dependencyExpressions)
  for (const key of cyclicKeys) {
    const expr = defs[key]
    issues.push({
      message: `Circular dependency detected: defs key "${key}" is involved in a dependency cycle`,
      path: ['defs', key],
      expression: expr ? getExpressionForKey(expr) : key,
    })
    if (!collectAllErrors) return false
  }

  return true
}

// ============================================================================
// Type checking
// ============================================================================

/** Maps a scalar definition type to the corresponding expression type. */
const SCALAR_DEFINITION_TYPES: Record<ScalarExpressionType, ExprType> = {
  boolean: T.boolean,
  string: T.string,
  number: T.number,
  integer: T.number,
  percentage: T.number,
  rating: T.number,
  date: T.date,
  time: T.time,
  datetime: T.datetime,
  duration: T.duration,
}

/**
 * Type-checks one expression against its declared type.
 *
 * @returns true if should continue validation
 */
export function typeCheckExpression(
  expr: unknown,
  path: (string | number)[],
  expected: ExprType,
  typeEnv: TypeEnv,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (typeof expr !== 'string') return true

  const result = validateExpressionType(expr, typeEnv, expected)
  if (!result.valid) {
    issues.push({
      message: result.message,
      path,
      expression: expr,
      expectedType: result.expectedType,
      actualType: result.actualType,
    })
    if (!collectAllErrors) return false
  }

  return true
}

/**
 * Type-checks one boolean gate (a required, visible, or include condition, or
 * a rule).
 *
 * @returns true if should continue validation
 */
export function typeCheckBooleanExpression(
  expr: CondExpr | undefined,
  path: (string | number)[],
  typeEnv: TypeEnv,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (typeof expr !== 'string') return true

  const result = validateBooleanType(expr, typeEnv)
  if (!result.valid) {
    issues.push({
      message: result.message,
      path,
      expression: expr,
      expectedType: result.expectedType,
      actualType: result.actualType,
    })
    if (!collectAllErrors) return false
  }

  return true
}

/**
 * Type-checks the declared result type of every definition expression.
 *
 * @returns true if should continue validation
 */
export function typeCheckDefsExpressions(
  defs: DefsSection | undefined,
  typeEnv: TypeEnv,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!defs) return true

  for (const [key, expr] of Object.entries(defs)) {
    if (isScalarExpressionType(expr.type)) {
      if (
        !typeCheckExpression(
          expr.value,
          ['defs', key, 'value'],
          SCALAR_DEFINITION_TYPES[expr.type],
          typeEnv,
          issues,
          collectAllErrors
        )
      ) {
        return false
      }
      continue
    }

    const propertyTypes = COMPLEX_TYPE_PROPERTIES[expr.type]
    if (!propertyTypes) continue
    for (const [property, propertyType] of Object.entries(propertyTypes)) {
      const propertyPath = property.split('.')
      const value = propertyPath.reduce<unknown>(
        (member, part) => (typeof member === 'object' && member !== null ? (member as Record<string, unknown>)[part] : undefined),
        expr.value
      )
      if (
        !typeCheckExpression(
          value,
          ['defs', key, 'value', ...propertyPath],
          propertyType,
          typeEnv,
          issues,
          collectAllErrors
        )
      ) {
        return false
      }
    }
  }

  return true
}
