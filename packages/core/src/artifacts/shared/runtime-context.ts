import type { AsOf } from '@paradoc/expr'
import type { RuntimeContext } from '@paradoc/types'

export type { RuntimeContext } from '@paradoc/types'

/** A caller-supplied instant accepted by runtime artifact creation methods. */
export type RuntimeAsOfInput = string | AsOf

/** Options that control the context captured for a runtime artifact instance. */
export interface RuntimeContextOptions {
	/** The instant to use for `today()` and `now()`. Defaults to the current instant. */
	asOf?: RuntimeAsOfInput
}

/** Options accepted by runtime artifact creation methods. */
export interface RuntimeCreationOptions {
	/** Fixed context retained by the created instance. */
	context?: RuntimeContextOptions
}

const ISO_INSTANT =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function invalidAsOf(value: unknown, reason: string): never {
	throw new TypeError(`Invalid context.asOf${reason ? `: ${reason}` : ''}. Expected an ISO 8601 instant with an explicit timezone.`)
}

function validateTimestamp(value: string, label: string): Date {
	const match = ISO_INSTANT.exec(value)
	if (!match) invalidAsOf(value, `${label} must include a time and explicit Z or UTC offset`)

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const hour = Number(match[4])
	const minute = Number(match[5])
	const second = Number(match[6] ?? '0')
	const offset = match[8]!
	const offsetHour = offset === 'Z' ? 0 : Number(offset.slice(1, 3))
	const offsetMinute = offset === 'Z' ? 0 : Number(offset.slice(4, 6))

	if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
		invalidAsOf(value, `${label} contains an invalid calendar date`)
	}
	if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
		invalidAsOf(value, `${label} contains an invalid time`)
	}

	const timestamp = new Date(value)
	if (Number.isNaN(timestamp.getTime())) invalidAsOf(value, `${label} is not a valid timestamp`)
	return timestamp
}

/**
 * Normalize a caller-supplied clock to the expression engine contract.
 * Calendar dates are derived from the normalized UTC instant, never the host
 * timezone or the process locale.
 */
export function normalizeRuntimeAsOf(input: RuntimeAsOfInput): RuntimeContext['asOf'] {
	if (typeof input === 'string') {
		const datetime = validateTimestamp(input, 'the timestamp').toISOString()
		return { date: datetime.slice(0, 10), datetime }
	}

	if (!input || typeof input !== 'object') invalidAsOf(input, 'the value')
	if (typeof input.datetime !== 'string' || typeof input.date !== 'string') {
		invalidAsOf(input, 'the value must contain date and datetime strings')
	}
	if (!ISO_DATE.test(input.date)) invalidAsOf(input, 'date must use YYYY-MM-DD form')

	const datetime = validateTimestamp(input.datetime, 'datetime').toISOString()
	const date = datetime.slice(0, 10)
	if (input.date !== date) {
		invalidAsOf(input, 'date must match the UTC calendar date derived from datetime')
	}
	return { date, datetime }
}

/** Capture one clock instant when no explicit context was supplied. */
export function captureRuntimeContext(options?: RuntimeCreationOptions): RuntimeContext {
	const input = options?.context?.asOf
	if (input !== undefined) return { asOf: normalizeRuntimeAsOf(input) }

	const datetime = new Date().toISOString()
	return { asOf: { date: datetime.slice(0, 10), datetime } }
}

/** Validate and detach a context restored from serialized runtime state. */
export function restoreRuntimeContext(context: RuntimeContext): RuntimeContext {
	if (!context || typeof context !== 'object' || !('asOf' in context)) {
		throw new TypeError('Invalid runtime context: context.asOf is required when restoring an instance.')
	}
	return { asOf: normalizeRuntimeAsOf(context.asOf) }
}
