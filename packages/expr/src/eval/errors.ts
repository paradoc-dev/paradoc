/** Runtime evaluation errors. The top-level wrapper maps these to results. */
import type { Span } from '../types'

export type EvalErrorCode =
	| 'division-by-zero'
	| 'type-error'
	| 'unknown-identifier'
	| 'unknown-function'
	| 'limit-exceeded'
	| 'missing-capability'
	| 'host-error'
	| 'arity'
	| 'missing-clock'

export class EvaluationError extends Error {
	constructor(
		readonly code: EvalErrorCode,
		message: string,
		readonly span?: Span,
	) {
		super(message)
		this.name = 'EvaluationError'
	}
}
