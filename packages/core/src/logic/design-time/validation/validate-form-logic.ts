import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  Form,
  FormField,
  FieldsetField,
  FormAnnex,
  FormParty,
  RulesSection,
} from '@paradoc/types'
import { createTypeEnv, T, type TypeEnv } from '@paradoc/expr'
import {
  buildFormRuleTypeAcc,
  buildFormTypeAcc,
  enterListRow,
  isRowReferencePath,
  rowScopeTypes,
  withRowScopeTypes,
  type ListRowScope,
} from '../type-checking'
import {
  validateExpression,
  validateReservedDefinitionNames,
  validateDefsSection,
  typeCheckExpression,
  typeCheckBooleanExpression,
  typeCheckDefsExpressions,
  type LogicValidationIssue,
  type LogicValidationOptions,
} from './shared'
import { defsDependencyExpressions } from '../../shared/defs-dependencies'

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

/**
 * Recursively validates expressions in field definitions.
 *
 * @param fields - Record of field definitions
 * @param basePath - Current path for error reporting
 * @param validVariables - Set of valid variable names
 * @param issues - Array to accumulate issues
 * @param collectAllErrors - Whether to collect all errors
 * @param rows - The list rows enclosing these fields, which `item` and `parent` resolve to
 * @returns true if should continue validation
 */
function validateFieldExpressions(
  fields: Record<string, FormField> | undefined,
  basePath: (string | number)[],
  validVariables: Set<string>,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean,
  rows?: ListRowScope
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
          collectAllErrors,
          rows
        )
      ) {
        return false
      }
    } else if (field.type === 'list') {
      // The item definition and everything inside it see the row as `item`
      // and, in a nested list, the enclosing row as `parent`.
      const rowScope = enterListRow(field, rows)
      const rowVariables = new Set([...validVariables].filter((path) => !isRowReferencePath(path)))
      for (const path of Object.keys(rowScopeTypes(rowScope))) rowVariables.add(path)
      if (!validateFieldExpressions(
        { item: field.item },
        fieldPath,
        rowVariables,
        issues,
        collectAllErrors,
        rowScope,
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
 * Type-checks expressions in field definitions.
 */
function typeCheckFieldExpressions(
  fields: Record<string, FormField> | undefined,
  basePath: (string | number)[],
  typeEnv: TypeEnv,
  issues: LogicValidationIssue[],
  collectAllErrors: boolean,
  rows?: ListRowScope
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
          collectAllErrors,
          rows
        )
      ) {
        return false
      }
    } else if (field.type === 'list') {
      const rowScope = enterListRow(field, rows)
      if (!typeCheckFieldExpressions(
        { item: field.item },
        fieldPath,
        withRowScopeTypes(typeEnv, rowScope),
        issues,
        collectAllErrors,
        rowScope,
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
  typeEnv: TypeEnv,
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

/** Type-checks all form-level rule gates. */
function typeCheckRuleExpressions(
  rules: RulesSection | undefined,
  typeEnv: TypeEnv,
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
  typeEnv: TypeEnv,
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
 *   version: '1.0.0',
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

  // The valid variables are the reference paths of the type environment, so
  // the reference pass and the type pass see the same paths.
  const referenceTypes = buildFormTypeAcc(form)
  const validVariables = new Set(Object.keys(referenceTypes))
  // Rules additionally expose fields by their direct paths at runtime.
  const ruleReferenceTypes = buildFormRuleTypeAcc(referenceTypes)
  const ruleVariables = new Set(Object.keys(ruleReferenceTypes))

  validateReservedDefinitionNames(form.defs, issues, collectAllErrors)

  // Validate defs section expressions and dependency cycles
  if ((collectAllErrors || issues.length === 0) && form.defs) {
    validateDefsSection(
      form.defs,
      defsDependencyExpressions(form.defs, form.fields),
      validVariables,
      issues,
      collectAllErrors
    )
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
    const typeEnv = createTypeEnv(referenceTypes)

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
      typeCheckRuleExpressions(form.rules, createTypeEnv(ruleReferenceTypes), issues, collectAllErrors)
    }
    if (collectAllErrors || issues.length === 0) {
      typeCheckPartyExpressions(form.parties, typeEnv, issues, collectAllErrors)
    }
  }

  // Return result
  return issues.length > 0 ? { issues } : { value: form }
}
