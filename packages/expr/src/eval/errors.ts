/** Runtime evaluation errors. The top-level wrapper maps these to results. */
import type { Expr } from '../ast/nodes'
import type { Span } from '../types'

export type EvalErrorCode =
	| 'division-by-zero'
	| 'type-error'
	| 'unknown-function'
	| 'limit-exceeded'
	| 'missing-capability'
	| 'host-error'
	| 'arity'
	| 'missing-clock'
	| 'currency-mismatch'
	/** An input the expression reads has no value yet; not a failure of the expression. */
	| 'missing-input'
	/** The source does not parse. A source over the length or nesting bound is `limit-exceeded`. */
	| 'syntax'

export class EvaluationError extends Error {
	constructor(
		readonly code: EvalErrorCode,
		message: string,
		readonly span?: Span,
		/**
		 * The operands the failing operation read that can hold a missing input:
		 * each one whose value is null, and each reference path. Set by the
		 * operation that failed, so an enclosing one does not replace it.
		 */
		readonly inputs?: readonly Expr[],
	) {
		super(message)
		this.name = 'EvaluationError'
	}
}
