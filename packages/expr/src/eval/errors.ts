/** Runtime evaluation errors. The top-level wrapper maps these to results. */

export type EvalErrorCode =
	| 'division-by-zero'
	| 'type-error'
	| 'unknown-identifier'
	| 'unknown-function'
	| 'arity'
	| 'missing-clock'

export class EvaluationError extends Error {
	constructor(
		readonly code: EvalErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'EvaluationError'
	}
}
