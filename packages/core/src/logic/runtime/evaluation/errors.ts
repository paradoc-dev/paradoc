/**
 * Custom error types for expression evaluation.
 */

/**
 * Error thrown when expression evaluation fails.
 */
export class ExpressionEvaluationError extends Error {
  /** The expression that failed to evaluate */
  readonly expression: string
  /** The original error that caused the failure */
  readonly cause: Error | undefined
  /** Path to the expression in the schema */
  readonly path: (string | number)[]

  constructor(options: {
    expression: string
    message: string
    cause?: Error
    path?: (string | number)[]
  }) {
    super(options.message)
    this.name = 'ExpressionEvaluationError'
    this.expression = options.expression
    this.cause = options.cause
    this.path = options.path ?? []

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ExpressionEvaluationError.prototype)
  }

  /**
   * Create an error for a syntax error in an expression.
   */
  static syntaxError(expression: string, error: Error, path?: (string | number)[]): ExpressionEvaluationError {
    return new ExpressionEvaluationError({
      expression,
      message: `Syntax error in expression "${expression}": ${error.message}`,
      cause: error,
      path,
    })
  }

  /**
   * Create an error for an undefined variable in an expression.
   */
  static undefinedVariable(expression: string, variable: string, path?: (string | number)[]): ExpressionEvaluationError {
    return new ExpressionEvaluationError({
      expression,
      message: `Undefined variable "${variable}" in expression "${expression}"`,
      path,
    })
  }

  /**
   * Create an error for a type mismatch in evaluation.
   */
  static typeMismatch(
    expression: string,
    expected: string,
    actual: string,
    path?: (string | number)[]
  ): ExpressionEvaluationError {
    return new ExpressionEvaluationError({
      expression,
      message: `Type mismatch in expression "${expression}": expected ${expected}, got ${actual}`,
      path,
    })
  }

  /**
   * Create an error for a general evaluation failure.
   */
  static evaluationFailed(expression: string, error: Error, path?: (string | number)[]): ExpressionEvaluationError {
    return new ExpressionEvaluationError({
      expression,
      message: `Failed to evaluate expression "${expression}": ${error.message}`,
      cause: error,
      path,
    })
  }
}
