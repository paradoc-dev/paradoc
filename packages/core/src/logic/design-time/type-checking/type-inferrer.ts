/**
 * Stack-based type inference engine for expressions.
 *
 * This module analyzes expr-eval-fork tokens to infer the return type
 * of an expression without evaluating it.
 *
 * Token types from expr-eval-fork:
 * - INUMBER: A number or string literal
 * - IVAR: A variable reference (e.g., 'isAdult')
 * - IMEMBER: Member access (e.g., '.value' after 'fields.age')
 * - IOP1: Unary operator (e.g., '!', '-', 'not')
 * - IOP2: Binary operator (e.g., '+', '==', '&&')
 * - IOP3: Ternary operator (e.g., '?:')
 * - IFUNCALL: Function call (value is arg count)
 * - IARRAY: Array literal (value is element count)
 */

import { Parser } from 'expr-eval-fork'
import type { InferredType, TypeInferenceResult } from './inferred-types'
import type { TypeEnvironment } from './type-environment'
import { getVariableType, getFunctionSignature } from './type-environment'

// Token type constants from expr-eval-fork
const INUMBER = 'INUMBER'
const IVAR = 'IVAR'
const IMEMBER = 'IMEMBER'
const IOP1 = 'IOP1'
const IOP2 = 'IOP2'
const IOP3 = 'IOP3'
const IFUNCALL = 'IFUNCALL'
const IARRAY = 'IARRAY'
const IEXPR = 'IEXPR'
const IEXPREVAL = 'IEXPREVAL'

// Operator classifications
const COMPARISON_OPS = new Set(['==', '!=', '===', '!==', '>', '<', '>=', '<=', 'in'])
const LOGICAL_OPS = new Set(['and', 'or', '&&', '||'])
const ARITHMETIC_OPS = new Set(['+', '-', '*', '/', '%', '^', '**'])
const UNARY_BOOLEAN_OPS = new Set(['!', 'not'])

/**
 * Token structure from expr-eval-fork
 */
interface Token {
  type: string
  value: unknown
}

/**
 * Internal structure for tracking type during inference
 */
interface TypeStackEntry {
  type: InferredType
  confidence: 'certain' | 'unknown'
  path?: string // For tracking variable paths through member access
}

// Singleton parser instance
const parser = new Parser({
  allowMemberAccess: true,
})

/**
 * Infers the return type of an expression.
 *
 * Uses stack-based analysis of expr-eval-fork tokens to determine
 * what type the expression will produce at runtime.
 *
 * @param expression - The expression string to analyze
 * @param environment - Type environment with variable and function types
 * @returns TypeInferenceResult with the inferred type and confidence
 *
 * @example
 * ```typescript
 * const env = buildFormTypeEnvironment(form)
 *
 * inferExpressionType('fields.age >= 18', env)
 * // { type: 'boolean', confidence: 'certain' }
 *
 * inferExpressionType('fields.age + 10', env)
 * // { type: 'number', confidence: 'certain' }
 *
 * inferExpressionType('unknownVar', env)
 * // { type: 'unknown', confidence: 'unknown', reason: 'Variable not found' }
 * ```
 */
export function inferExpressionType(
  expression: string,
  environment: TypeEnvironment
): TypeInferenceResult {
  try {
    const parsed = parser.parse(expression)

    // Access the internal tokens from the parsed expression
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokens: Token[] = (parsed as any).tokens

    if (!tokens || !Array.isArray(tokens)) {
      return {
        type: 'unknown',
        confidence: 'unknown',
        reason: 'Could not access expression tokens',
      }
    }

    return inferFromTokens(tokens, environment)
  } catch (e) {
    return {
      type: 'unknown',
      confidence: 'unknown',
      reason: e instanceof Error ? e.message : 'Parse error',
    }
  }
}

/**
 * Processes tokens using a stack-based approach to infer the final type.
 */
function inferFromTokens(tokens: Token[], environment: TypeEnvironment): TypeInferenceResult {
  const stack: TypeStackEntry[] = []
  let currentPath: string | null = null
  let lastFunctionName: string | null = null

  for (const token of tokens) {
    switch (token.type) {
      case INUMBER: {
        // INUMBER can be a number or a string literal
        const valueType = typeof token.value === 'string' ? 'string' : 'number'
        stack.push({ type: valueType, confidence: 'certain' })
        currentPath = null
        break
      }

      case IVAR: {
        // Variable reference - could be start of member access chain
        const varName = String(token.value)
        currentPath = varName

        // Check if it's a known variable or logic key
        const varType = getVariableType(environment, varName)

        // Store the function name for later IFUNCALL
        lastFunctionName = varName

        stack.push({
          type: varType.type,
          confidence: varType.confidence,
          path: varName,
        })
        break
      }

      case IMEMBER: {
        // Member access (e.g., .value)
        const memberName = String(token.value)
        currentPath = currentPath ? `${currentPath}.${memberName}` : memberName

        // Pop the base object and push the member type
        if (stack.length > 0) {
          stack.pop()
        }

        // Look up the full path
        const memberType = getVariableType(environment, currentPath)
        stack.push({
          type: memberType.type,
          confidence: memberType.confidence,
          path: currentPath,
        })
        break
      }

      case IOP1: {
        // Unary operator
        const op = String(token.value)
        if (stack.length > 0) {
          stack.pop()
        }

        if (UNARY_BOOLEAN_OPS.has(op)) {
          // Logical NOT always returns boolean
          stack.push({ type: 'boolean', confidence: 'certain' })
        } else {
          // Unary minus returns number
          stack.push({ type: 'number', confidence: 'certain' })
        }
        currentPath = null
        break
      }

      case IOP2: {
        // Binary operator
        const op = String(token.value)
        if (stack.length > 0) stack.pop()
        if (stack.length > 0) stack.pop()

        if (COMPARISON_OPS.has(op) || LOGICAL_OPS.has(op)) {
          // Comparison and logical operators return boolean
          stack.push({ type: 'boolean', confidence: 'certain' })
        } else if (ARITHMETIC_OPS.has(op)) {
          // Arithmetic operators return number (except + which could be string concat)
          // For now, assume number since type coercion will handle it
          stack.push({ type: 'number', confidence: 'certain' })
        } else if (op === '||' && stack.length === 0) {
          // Handle coalesce-style || - result type is unknown
          stack.push({ type: 'unknown', confidence: 'unknown' })
        } else {
          stack.push({ type: 'unknown', confidence: 'unknown' })
        }
        currentPath = null
        break
      }

      case IOP3: {
        // Ternary operator (condition ? then : else)
        const elseEntry = stack.pop()
        const thenEntry = stack.pop()
        stack.pop() // condition

        // Result type is the common type of then/else branches
        if (thenEntry && elseEntry && thenEntry.type === elseEntry.type) {
          stack.push({ type: thenEntry.type, confidence: thenEntry.confidence })
        } else {
          // Types don't match - result is unknown
          stack.push({ type: 'unknown', confidence: 'unknown' })
        }
        currentPath = null
        break
      }

      case IFUNCALL: {
        // Function call - value is the argument count
        const argCount = token.value as number

        // Pop arguments and the function reference
        for (let i = 0; i <= argCount && stack.length > 0; i++) {
          stack.pop()
        }

        // Look up function return type
        if (lastFunctionName) {
          const funcSig = getFunctionSignature(environment, lastFunctionName)
          if (funcSig) {
            stack.push({ type: funcSig.returnType, confidence: 'certain' })
          } else {
            stack.push({
              type: 'unknown',
              confidence: 'unknown',
            })
          }
        } else {
          stack.push({ type: 'unknown', confidence: 'unknown' })
        }
        currentPath = null
        lastFunctionName = null
        break
      }

      case IARRAY: {
        // Array literal - value is element count
        const elementCount = token.value as number
        for (let i = 0; i < elementCount && stack.length > 0; i++) {
          stack.pop()
        }
        stack.push({ type: 'array', confidence: 'certain' })
        currentPath = null
        break
      }

      case IEXPR:
      case IEXPREVAL: {
        // Expression grouping - doesn't change type
        // These are typically used for parentheses and nested expressions
        break
      }

      default: {
        // Unknown token type - push unknown
        stack.push({ type: 'unknown', confidence: 'unknown' })
        currentPath = null
      }
    }
  }

  // Return the final type on the stack
  if (stack.length > 0) {
    const result = stack[stack.length - 1]
    return {
      type: result?.type ?? 'unknown',
      confidence: result?.confidence ?? 'unknown',
    }
  }

  return {
    type: 'unknown',
    confidence: 'unknown',
    reason: 'Empty expression result',
  }
}
