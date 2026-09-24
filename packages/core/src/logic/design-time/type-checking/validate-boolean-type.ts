/**
 * Type-checks expressions against the type they must return: a boolean gate
 * (required, visible, include) via @paradoc/expr's checkBooleanGate, or a
 * definition or payment value via its declared type.
 */

import { check, checkBooleanGate, formatType, typesEqual, T, type Diagnostic, type ExprType, type TypeEnv } from '@paradoc/expr'

/** The result of type-checking one expression. Types are `formatType` names. */
export type TypeValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly message: string
      readonly expectedType: string
      readonly actualType: string
    }

/**
 * Diagnostics the syntax and reference pass reports: an expression that does
 * not parse, and a reference that does not resolve. The type pass leaves them
 * out, so each problem is reported once.
 */
const REFERENCE_PASS_CODES: ReadonlySet<Diagnostic['code']> = new Set([
  'syntax',
  'forbidden-operator',
  'limit-exceeded',
  'unknown-identifier',
])

function typeDiagnostic(diagnostics: readonly Diagnostic[]): Diagnostic | undefined {
  return diagnostics.find((diagnostic) => !REFERENCE_PASS_CODES.has(diagnostic.code))
}

/** Validates that an expression used as a boolean gate returns a boolean. */
export function validateBooleanType(expression: string, environment: TypeEnv): TypeValidationResult {
  const { type, diagnostics } = checkBooleanGate(expression, environment)
  const diagnostic = typeDiagnostic(diagnostics)
  if (!diagnostic) return { valid: true }
  return {
    valid: false,
    message: diagnostic.message,
    expectedType: formatType(T.boolean),
    actualType: formatType(type),
  }
}

/** Validates an expression against a declared result type. */
export function validateExpressionType(
  expression: string,
  environment: TypeEnv,
  expected: ExprType
): TypeValidationResult {
  const { type, diagnostics } = check(expression, environment)
  const diagnostic = typeDiagnostic(diagnostics)

  if (diagnostic) {
    return {
      valid: false,
      message: diagnostic.message,
      expectedType: formatType(expected),
      actualType: formatType(type),
    }
  }

  if (type.kind === 'unknown' || typesEqual(type, expected)) return { valid: true }

  return {
    valid: false,
    message: `Expected expression type ${formatType(expected)}, got ${formatType(type)}`,
    expectedType: formatType(expected),
    actualType: formatType(type),
  }
}
