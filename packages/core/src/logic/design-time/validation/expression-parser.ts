import { parse, extractReferences } from '@paradoc/expr'

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
	/** Whether every dependency path was statically resolvable. */
	fullyStatic: boolean
}

/**
 * Parses an expression string and extracts referenced variables.
 *
 * Backed by @paradoc/expr: the parser reports a positioned syntax error, and
 * `extractReferences` returns the identifier-rooted dotted paths the expression
 * depends on (function names are not references).
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
 * // { success: false, variables: [], error: '...' }
 * ```
 */
export function parseExpression(expr: string): ParseResult {
  const { ast, errors } = parse(expr)
  if (!ast) {
    return {
      success: false,
      variables: [],
      error: errors[0]?.message ?? 'Unknown parse error',
		fullyStatic: false,
    }
  }
	const references = extractReferences(ast)
	return { success: true, variables: [...references.paths], fullyStatic: references.fullyStatic }
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
