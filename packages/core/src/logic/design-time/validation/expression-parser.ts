import { Parser } from 'expr-eval-fork'

/**
 * Result of parsing an expression
 */
export interface ParseResult {
  /** Whether the expression parsed successfully */
  success: boolean
  /** Variables referenced in the expression (e.g., ['fields.age', 'isAdult']) */
  variables: string[]
  /** Error message if parsing failed */
  error?: string
}

// Singleton parser instance with member access enabled
const parser = new Parser({
  allowMemberAccess: true,
})

/**
 * Parses an expression string and extracts referenced variables.
 *
 * @param expr - The expression string to parse
 * @returns ParseResult with success status and extracted variables
 *
 * @example
 * ```typescript
 * parseExpression('fields.age >= 18')
 * // { success: true, variables: ['fields.age'] }
 *
 * parseExpression('fields.age >=')
 * // { success: false, variables: [], error: 'Unexpected end of expression' }
 * ```
 */
export function parseExpression(expr: string): ParseResult {
  try {
    const parsed = parser.parse(expr)
    const variables = parsed.variables({ withMembers: true })
    return { success: true, variables }
  } catch (e) {
    return {
      success: false,
      variables: [],
      error: e instanceof Error ? e.message : 'Unknown parse error',
    }
  }
}

/**
 * Validates that an expression string has valid syntax.
 *
 * @param expr - The expression string to validate
 * @returns true if valid, error message string if invalid
 */
export function validateExpressionSyntax(expr: string): true | string {
  const result = parseExpression(expr)
  return result.success ? true : (result.error ?? 'Invalid expression')
}
