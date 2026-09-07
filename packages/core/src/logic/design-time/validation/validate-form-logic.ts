import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  Form,
  FormField,
  FieldsetField,
  FormAnnex,
  FormParty,
  CondExpr,
  Expression,
  DefsSection,
  RulesSection,
  ScalarExpressionType,
} from '@paradoc/types'
import { T, type ExprType } from '@paradoc/expr'
import type { TypeEnvironment, TypeValidationSeverity, InferredType } from '../type-checking'
import { collectFieldPaths } from './field-paths'
import {
  buildFormRuleTypeEnvironment,
  buildFormTypeEnvironment,
  validateBooleanType,
  validateExpressionType,
  topologicalSortDefsKeys,
} from '../type-checking'
import { validateExpression } from './shared'

/** Scalar expression types (value is a string expression) */
const SCALAR_EXPRESSION_TYPES: Set<string> = new Set([
  'boolean',
  'string',
  'number',
  'integer',
  'percentage',
  'rating',
  'date',
  'time',
  'datetime',
  'duration',
])

/**
 * Check if an expression type is a scalar type.
 */
function isScalarExpressionType(type: string): type is ScalarExpressionType {
  return SCALAR_EXPRESSION_TYPES.has(type)
}

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

/** Expected types for object-valued definition properties. */
const OBJECT_DEFINITION_PROPERTY_TYPES: Record<string, Record<string, ExprType>> = {
  money: { amount: T.number, currency: T.string },
  address: {
    line1: T.string,
    line2: T.string,
    locality: T.string,
    region: T.string,
    postalCode: T.string,
    country: T.string,
  },
  phone: { number: T.string, type: T.string, extension: T.string },
  coordinate: { lat: T.number, lon: T.number },
  bbox: { north: T.number, south: T.number, east: T.number, west: T.number },
  person: {
    name: T.string,
    firstName: T.string,
    middleName: T.string,
    lastName: T.string,
    suffix: T.string,
    title: T.string,
  },
  organization: {
    name: T.string,
    legalName: T.string,
    domicile: T.string,
    entityType: T.string,
    entityId: T.string,
    taxId: T.string,
  },
  identification: {
    type: T.string,
    number: T.string,
    issuer: T.string,
    issueDate: T.date,
    expiryDate: T.date,
  },
}

/**
 * Options for logic validation
 */
export interface LogicValidationOptions {
  /** Whether to collect all errors or stop at first. Default: true */
  collectAllErrors?: boolean
}

/**
 * A validation issue from logic validation
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
  /** Severity of the issue: 'error' for certain failures, 'warning' for unknown types */
  severity?: TypeValidationSeverity
  /** Expected type (for type validation issues) */
  expectedType?: InferredType
  /** Actual inferred type (for type validation issues) */
  actualType?: InferredType
}

/** Records all statically addressable members of definition expressions. */
function addDefinitionPaths(
  defs: DefsSection | undefined,
  validVariables: Set<string>
): void {
  if (!defs) return

  for (const [key, expr] of Object.entries(defs)) {
    validVariables.add(key)
    if (!isScalarExpressionType(expr.type)) {
      const properties = OBJECT_DEFINITION_PROPERTY_TYPES[expr.type]
      if (properties) {
        for (const property of Object.keys(properties)) {
          validVariables.add(`${key}.${property}`)
        }
      }
    }
  }
}

/** Whether a payment amount is an expression object rather than fixed Money. */
function isMoneyExpression(
  amount: unknown
): amount is { type: 'money'; value: { amount: string; currency: string } } {
  return (
    typeof amount === 'object' &&
    amount !== null &&
    (amount as { type?: unknown }).type === 'money' &&
    typeof (amount as { value?: unknown }).value === 'object' &&
    (amount as { value: { amount?: unknown } }).value !== null &&
    typeof (amount as { value: { amount?: unknown } }).value.amount === 'string' &&
    typeof (amount as { value: { currency?: unknown } }).value.currency === 'string'
  )
}

/** Adds one non-gate expression type issue, preserving the shared issue shape. */
function typeCheckExpression(
  expr: unknown,
  path: (string | number)[],
  expected: ExprType,
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (typeof expr !== 'string') return true

  const result = validateExpressionType(expr, typeEnv, expected)
  if (!result.valid) {
    issues.push({
      message: result.message ?? 'Type validation failed',
      path,
      expression: expr,
      severity: result.severity,
      expectedType: result.expectedType,
      actualType: result.actualType,
    })
    if (!collectAllErrors) return false
  }

  return true
}

/**
 * Recursively validates expressions in field definitions.
 *
 * @param fields - Record of field definitions
 * @param basePath - Current path for error reporting
 * @param validVariables - Set of valid variable names
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @returns true if should continue validation
 */
function validateFieldExpressions(
  fields: Record<string, FormField> | undefined,
  basePath: (string | number)[],
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!fields) return true

  for (const [fieldId, field] of Object.entries(fields)) {
    const fieldPath = [...basePath, fieldId]

    // Validate required expression
    if (
      !validateExpression(
        field.required,
        [...fieldPath, 'required'],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Validate visible expression
    if (
      !validateExpression(
        field.visible,
        [...fieldPath, 'visible'],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Recurse into fieldsets
    if (field.type === 'fieldset') {
      const fieldset = field as FieldsetField
      if (
        !validateFieldExpressions(
          fieldset.fields,
          [...fieldPath, 'fields'],
          validVariables,
          issues,
          collectAllErrors
        )
      ) {
        return false
      }
    } else if (field.type === 'list') {
      if (!validateFieldExpressions(
        { item: field.item },
        fieldPath,
        validVariables,
        issues,
        collectAllErrors,
      )) return false
    }
  }

  return true
}

/**
 * Validates expressions in annex definitions.
 *
 * @param annexes - Record of annex definitions keyed by ID
 * @param validVariables - Set of valid variable names
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @returns true if should continue validation
 */
function validateAnnexExpressions(
  annexes: Record<string, FormAnnex> | undefined,
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!annexes) return true

  for (const [annexId, annex] of Object.entries(annexes)) {
    if (!annex) continue
    const annexPath = ['annexes', annexId]

    // Validate required expression
    if (
      !validateExpression(
        annex.required,
        [...annexPath, 'required'],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Validate visible expression
    if (
      !validateExpression(
        annex.visible,
        [...annexPath, 'visible'],
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

/** Validates form-level rule expressions. */
function validateRuleExpressions(
  rules: RulesSection | undefined,
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!rules) return true

  for (const [ruleId, rule] of Object.entries(rules)) {
    if (
      !validateExpression(
        rule.expr,
        ['rules', ruleId, 'expr'],
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

/** Validates party requiredness and payment component expressions. */
function validatePartyExpressions(
  parties: Record<string, FormParty> | undefined,
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!parties) return true

  for (const [partyId, party] of Object.entries(parties)) {
    if (
      !validateExpression(
        party.required,
        ['parties', partyId, 'required'],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    const payment = party.payment
    if (!payment || !isMoneyExpression(payment.amount)) continue

    if (
      !validateExpression(
        payment.amount.value.amount,
        ['parties', partyId, 'payment', 'amount', 'value', 'amount'],
        validVariables,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }
    if (
      !validateExpression(
        payment.amount.value.currency,
        ['parties', partyId, 'payment', 'amount', 'value', 'currency'],
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
 * Type-checks a single boolean expression.
 *
 * @param expr - The expression to type-check
 * @param path - JSON path for error reporting
 * @param typeEnv - Type environment
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @returns true if should continue validation
 */
function typeCheckBooleanExpression(
  expr: CondExpr | undefined,
  path: (string | number)[],
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  // Only check string expressions
  if (typeof expr !== 'string') return true

  const result = validateBooleanType(expr, typeEnv)

  if (!result.valid) {
    issues.push({
      message: result.message ?? 'Type validation failed',
      path,
      expression: expr,
      severity: result.severity,
      expectedType: result.expectedType,
      actualType: result.actualType,
    })
    if (!collectAllErrors) return false
  }

  return true
}

/**
 * Type-checks expressions in field definitions.
 */
function typeCheckFieldExpressions(
  fields: Record<string, FormField> | undefined,
  basePath: (string | number)[],
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!fields) return true

  for (const [fieldId, field] of Object.entries(fields)) {
    const fieldPath = [...basePath, fieldId]

    // Type-check required expression
    if (
      !typeCheckBooleanExpression(
        field.required,
        [...fieldPath, 'required'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Type-check visible expression
    if (
      !typeCheckBooleanExpression(
        field.visible,
        [...fieldPath, 'visible'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Recurse into fieldsets
    if (field.type === 'fieldset') {
      const fieldset = field as FieldsetField
      if (
        !typeCheckFieldExpressions(
          fieldset.fields,
          [...fieldPath, 'fields'],
          typeEnv,
          issues,
          collectAllErrors
        )
      ) {
        return false
      }
    } else if (field.type === 'list') {
      if (!typeCheckFieldExpressions(
        { item: field.item },
        fieldPath,
        typeEnv,
        issues,
        collectAllErrors,
      )) return false
    }
  }

  return true
}

/**
 * Type-checks expressions in annex definitions.
 */
function typeCheckAnnexExpressions(
  annexes: Record<string, FormAnnex> | undefined,
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!annexes) return true

  for (const [annexId, annex] of Object.entries(annexes)) {
    if (!annex) continue
    const annexPath = ['annexes', annexId]

    // Type-check required expression
    if (
      !typeCheckBooleanExpression(
        annex.required,
        [...annexPath, 'required'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    // Type-check visible expression
    if (
      !typeCheckBooleanExpression(
        annex.visible,
        [...annexPath, 'visible'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }
  }

  return true
}

/** Type-checks the declared result type of every definition expression. */
function typeCheckDefsExpressions(
  defs: DefsSection | undefined,
  typeEnv: TypeEnvironment,
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

    const propertyTypes = OBJECT_DEFINITION_PROPERTY_TYPES[expr.type]
    if (!propertyTypes) continue
    const values = expr.value as unknown as Record<string, string | undefined>
    for (const [property, propertyType] of Object.entries(propertyTypes)) {
      if (
        !typeCheckExpression(
          values[property],
          ['defs', key, 'value', property],
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

/** Type-checks all form-level rule gates. */
function typeCheckRuleExpressions(
  rules: RulesSection | undefined,
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!rules) return true

  for (const [ruleId, rule] of Object.entries(rules)) {
    if (
      !typeCheckBooleanExpression(
        rule.expr,
        ['rules', ruleId, 'expr'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }
  }

  return true
}

/** Type-checks party requiredness and variable payment expressions. */
function typeCheckPartyExpressions(
  parties: Record<string, FormParty> | undefined,
  typeEnv: TypeEnvironment,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean
): boolean {
  if (!parties) return true

  for (const [partyId, party] of Object.entries(parties)) {
    if (
      !typeCheckBooleanExpression(
        party.required,
        ['parties', partyId, 'required'],
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }

    const payment = party.payment
    if (!payment || !isMoneyExpression(payment.amount)) continue

    if (
      !typeCheckExpression(
        payment.amount.value.amount,
        ['parties', partyId, 'payment', 'amount', 'value', 'amount'],
        T.number,
        typeEnv,
        issues,
        collectAllErrors
      )
    ) {
      return false
    }
    if (
      !typeCheckExpression(
        payment.amount.value.currency,
        ['parties', partyId, 'payment', 'amount', 'value', 'currency'],
        T.string,
        typeEnv,
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
function validateDefsExpression(
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
  const valueObj = expr.value as unknown as Record<string, string | undefined>

  for (const [propKey, propExpr] of Object.entries(valueObj)) {
    if (propExpr !== undefined) {
      if (
        !validateExpression(
          propExpr,
          ['defs', key, 'value', propKey],
          validVariables,
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

/**
 * Extracts expression strings from a DefsSection for dependency sorting.
 *
 * For scalar types, returns the value directly.
 * For object types, concatenates all property expressions.
 *
 * @param logic - The defs section
 * @returns Record of key → expression string(s) for sorting
 */
function extractExpressionsForSorting(logic: DefsSection): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, expr] of Object.entries(logic)) {
    if (isScalarExpressionType(expr.type)) {
      // Scalar: value is the expression string
      result[key] = expr.value as string
    } else {
      // Object: concatenate all property expressions for dependency detection
      // Use ' and ' as delimiter to create a valid parseable expression
      const valueObj = expr.value as unknown as Record<string, string | undefined>
      const allExprs = Object.values(valueObj).filter((v): v is string => v !== undefined)
      result[key] = allExprs.join(' and ')
    }
  }

  return result
}

/**
 * Gets the expression string for a defs key (for error reporting).
 */
function getExpressionForKey(expr: Expression): string {
  if (isScalarExpressionType(expr.type)) {
    return expr.value as string
  }
  // For object types, show the first property expression
  const valueObj = expr.value as unknown as Record<string, string | undefined>
  const firstExpr = Object.values(valueObj).find((v) => v !== undefined)
  return firstExpr ?? '[object expression]'
}

/**
 * Validates all defs expressions in a Form artifact.
 *
 * Checks:
 * 1. Expression syntax using the @paradoc/expr parser
 * 2. Variable references exist (field paths or defs keys)
 * 3. Expressions in boolean contexts return boolean type
 *
 * @param form - The Form artifact to validate
 * @param options - Validation options
 * @returns Standard Schema result: { value } on success, { issues } on failure
 *
 * @example
 * ```typescript
 * const form: Form = {
 *   kind: 'form',
 *   name: 'test',
 *   version: '1.0',
 *   title: 'Test',
 *   defs: {
 *     isAdult: {
 *       type: 'boolean',
 *       value: 'fields.age >= 18'
 *     }
 *   },
 *   fields: {
 *     age: { type: 'number' },
 *     consent: { type: 'boolean', visible: 'isAdult' }
 *   }
 * }
 *
 * const result = validateFormDefs(form)
 * // { value: form } - valid
 *
 * const invalid: Form = {
 *   ...form,
 *   defs: {
 *     broken: {
 *       type: 'boolean',
 *       value: 'fields.nonexistent'
 *     }
 *   }
 * }
 * const result2 = validateFormDefs(invalid)
 * // { issues: [{ message: 'Unknown variable: "fields.nonexistent"', ... }] }
 * ```
 */
export function validateFormDefs(
  form: Form,
  options: LogicValidationOptions = {}
): StandardSchemaV1.Result<Form> {
  const { collectAllErrors = true } = options
  const issues: LogicValidationIssue[] = []

  // Build valid variable set
  const validVariables = new Set<string>()

  // Add all field paths (e.g., 'fields.age', 'fields.address.street')
  collectFieldPaths(form.fields).forEach((p) => validVariables.add(p))

  // Add all defs keys and their statically known object members as valid variables
  addDefinitionPaths(form.defs, validVariables)

  // Rules additionally expose top-level fields by their direct IDs at runtime.
  const ruleVariables = new Set(validVariables)
  for (const fieldId of Object.keys(form.fields ?? {})) {
    ruleVariables.add(fieldId)
  }

  // Validate defs section expressions
  if (form.defs) {
    for (const [key, expr] of Object.entries(form.defs)) {
      if (!validateDefsExpression(expr, key, validVariables, issues, collectAllErrors)) {
        break
      }
    }

    // Extract expressions for dependency sorting
    const expressionsForSorting = extractExpressionsForSorting(form.defs)

    // Check for circular dependencies in defs keys
    const { cyclicKeys } = topologicalSortDefsKeys(expressionsForSorting)
    for (const key of cyclicKeys) {
      const logicExpr = form.defs[key]
      issues.push({
        message: `Circular dependency detected: defs key "${key}" is involved in a dependency cycle`,
        path: ['defs', key],
        expression: logicExpr ? getExpressionForKey(logicExpr) : key,
        severity: 'warning',
      })
      if (!collectAllErrors) break
    }
  }

  // Validate field expressions (recursive for fieldsets)
  if (collectAllErrors || issues.length === 0) {
    validateFieldExpressions(form.fields, ['fields'], validVariables, issues, collectAllErrors)
  }

  // Validate annex expressions
  if (collectAllErrors || issues.length === 0) {
    validateAnnexExpressions(form.annexes, validVariables, issues, collectAllErrors)
  }

  // Validate form rules and party expressions, which use the same expression
  // language as field and annex conditions.
  if (collectAllErrors || issues.length === 0) {
    validateRuleExpressions(form.rules, ruleVariables, issues, collectAllErrors)
  }
  if (collectAllErrors || issues.length === 0) {
    validatePartyExpressions(form.parties, validVariables, issues, collectAllErrors)
  }

  // Phase 2: Type checking
  // Only proceed if syntax and variable validation passed (or collecting all errors)
  if (collectAllErrors || issues.length === 0) {
    // Build type environment for type inference
    const typeEnv = buildFormTypeEnvironment(form)

    // Check typed definitions before their values flow into other gates.
    if (collectAllErrors || issues.length === 0) {
      typeCheckDefsExpressions(form.defs, typeEnv, issues, collectAllErrors)
    }

    // Type-check field expressions
    if (collectAllErrors || issues.length === 0) {
      typeCheckFieldExpressions(form.fields, ['fields'], typeEnv, issues, collectAllErrors)
    }

    // Type-check annex expressions
    if (collectAllErrors || issues.length === 0) {
      typeCheckAnnexExpressions(form.annexes, typeEnv, issues, collectAllErrors)
    }

    // Rules support direct top-level field references, so they use a slightly
    // wider environment than field/annex conditions.
    if (collectAllErrors || issues.length === 0) {
      typeCheckRuleExpressions(
        form.rules,
        buildFormRuleTypeEnvironment(form),
        issues,
        collectAllErrors
      )
    }
    if (collectAllErrors || issues.length === 0) {
      typeCheckPartyExpressions(form.parties, typeEnv, issues, collectAllErrors)
    }
  }

  // Return result
  return issues.length > 0 ? { issues } : { value: form }
}
