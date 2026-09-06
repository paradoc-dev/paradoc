/**
 * Datetime serializer - validator and parsing helper for calendar date/time values
 */

import { isValidCalendarDate, parseIsoParts, toUtcDate } from "./iso";

/**
 * Assert a datetime value is valid. Throws error if invalid.
 * Accepts an ISO 8601 datetime string (offset or offsetless) or a `Date`
 * instance.
 */
export function assertDatetime(value: unknown): void {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error('Invalid datetime: Date object is invalid')
		}
		return
	}
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid datetime: must be a string or Date, got ${typeof value}`)
	}
	if (value === '') {
		throw new Error('Invalid datetime: cannot be empty')
	}
	const parts = parseIsoParts(value)
	if (!parts || !isValidCalendarDate(parts)) {
		throw new Error(`Invalid datetime: cannot parse "${value}"`)
	}
}

/**
 * Parse a validated datetime value into a `Date` instance carrying, in its
 * UTC getters, the value's own written wall-clock components — the offset it
 * declared (or UTC when it declared none, never the host machine's local
 * time zone).
 */
export function toDatetime(value: string | Date): Date {
	if (value instanceof Date) return value
	const parts = parseIsoParts(value)
	if (!parts) throw new Error(`Invalid datetime: cannot parse "${value}"`)
	return toUtcDate(parts)
}
