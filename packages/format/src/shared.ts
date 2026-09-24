import type { FormatIssue, FormatKind } from './types'

/** The failure statuses a value check can report before any formatting runs. */
export type ValidationStatus = 'missing' | 'incomplete' | 'invalid'

export interface ValidationSuccess<T> {
	ok: true
	value: T
}

export interface ValidationFailure {
	ok: false
	status: ValidationStatus
	issues: readonly FormatIssue[]
}

export type Validation<T> = ValidationSuccess<T> | ValidationFailure

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isMissing(value: unknown): value is null | undefined {
	return value === null || value === undefined
}

export function issue(
	kind: FormatKind | string,
	code: string,
	message: string,
	path?: string,
	cause?: unknown,
): FormatIssue {
	return { code, message, kind, ...(path === undefined ? {} : { path }), ...(cause === undefined ? {} : { cause }) }
}

/** `invalid` when any issue is a wrong member or object, otherwise `incomplete`. */
export function statusForIssues(issues: readonly FormatIssue[]): Exclude<ValidationStatus, 'missing'> {
	return issues.some((item) => item.code.startsWith('invalid')) ? 'invalid' : 'incomplete'
}
