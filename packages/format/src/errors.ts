import type { FormatIssue, FormatKind, FormatStatus } from './types'

/** A structured failure raised by a strict formatter operation. */
export class FormatError extends Error {
	readonly status: Exclude<FormatStatus, 'formatted'>
	readonly kind: FormatKind | string
	readonly issues: readonly FormatIssue[]

	constructor(
		status: Exclude<FormatStatus, 'formatted'>,
		kind: FormatKind | string,
		issues: readonly FormatIssue[],
	) {
		super(issues[0]?.message ?? `Unable to format ${kind}`)
		this.name = 'FormatError'
		this.status = status
		this.kind = kind
		this.issues = issues
	}
}

/** A construction or immutable-composition option is not usable. */
export class FormatConfigurationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'FormatConfigurationError'
	}
}

export function isFormatError(value: unknown): value is FormatError {
	return value instanceof FormatError
}
