/**
 * Type environment for expression type inference.
 *
 * The type environment tracks:
 * 1. Variable types: Field value types and logic key types
 * 2. Function signatures: Return types for built-in functions
 */

import type { InferredType, TypeInferenceResult } from './inferred-types'

/**
 * Signature for a function, tracking its return type.
 * This is used to infer the type of function call expressions.
 */
export interface FunctionSignature {
  /** The return type of the function */
  returnType: InferredType
}

/**
 * Type environment containing variables and functions.
 */
export interface TypeEnvironment {
  /** Maps variable paths to their inferred types (e.g., 'fields.age' -> number) */
  variables: Map<string, TypeInferenceResult>
  /** Maps function names to their signatures */
  functions: Map<string, FunctionSignature>
}

/**
 * Built-in functions and their return types.
 *
 * These match the standard functions that will be available in expressions.
 * Functions are grouped by their return type for clarity.
 */
export const BUILTIN_FUNCTIONS: Record<string, FunctionSignature> = {
  // Boolean-returning functions
  contains: { returnType: 'boolean' },
  startsWith: { returnType: 'boolean' },
  endsWith: { returnType: 'boolean' },
  matches: { returnType: 'boolean' },
  isEmpty: { returnType: 'boolean' },
  isNotEmpty: { returnType: 'boolean' },

  // String-returning functions
  upper: { returnType: 'string' },
  lower: { returnType: 'string' },
  trim: { returnType: 'string' },
  concat: { returnType: 'string' },

  // Number-returning functions
  length: { returnType: 'number' },
  abs: { returnType: 'number' },
  min: { returnType: 'number' },
  max: { returnType: 'number' },
  ceil: { returnType: 'number' },
  floor: { returnType: 'number' },
  round: { returnType: 'number' },
  sqrt: { returnType: 'number' },
  pow: { returnType: 'number' },
  log: { returnType: 'number' },
  exp: { returnType: 'number' },
  sin: { returnType: 'number' },
  cos: { returnType: 'number' },
  tan: { returnType: 'number' },

  // Coalesce returns unknown (depends on inputs)
  coalesce: { returnType: 'unknown' },
}

/**
 * Creates an empty type environment with built-in functions.
 *
 * @returns A new TypeEnvironment with empty variables and built-in functions
 */
export function createTypeEnvironment(): TypeEnvironment {
  return {
    variables: new Map(),
    functions: new Map(Object.entries(BUILTIN_FUNCTIONS)),
  }
}

/**
 * Gets a variable's type from the environment.
 *
 * @param env - The type environment
 * @param path - The variable path (e.g., 'fields.age', 'isAdult')
 * @returns The inferred type, or unknown if not found
 */
export function getVariableType(env: TypeEnvironment, path: string): TypeInferenceResult {
  return (
    env.variables.get(path) ?? {
      type: 'unknown',
      confidence: 'unknown',
      reason: `Variable "${path}" not found in environment`,
    }
  )
}

/**
 * Gets a function's signature from the environment.
 *
 * @param env - The type environment
 * @param name - The function name
 * @returns The function signature, or undefined if not found
 */
export function getFunctionSignature(env: TypeEnvironment, name: string): FunctionSignature | undefined {
  return env.functions.get(name)
}
