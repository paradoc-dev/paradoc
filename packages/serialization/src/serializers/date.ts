/**
 * Date serializer - validator and parsing helper for calendar dates
 */

import { isValidCalendarDate, parseIsoParts, toUtcDate } from "./iso";

/**
 * Assert a date value is valid. Throws error if invalid.
 * Accepts a plain `YYYY-MM-DD` date, an ISO 8601 datetime string (offset or
 * offsetless), or a `Date` instance.
 */
export function assertDate(value: unknown): void {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error('Invalid date: Date object is invalid')
		}
		return
	}
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid date: must be a string or Date, got ${typeof value}`)
	}
	if (value === '') {
		throw new Error('Invalid date: cannot be empty')
	}
	const parts = parseIsoParts(value)
	if (!parts || !isValidCalendarDate(parts)) {
		throw new Error(`Invalid date: cannot parse "${value}"`)
	}
}

/**
 * Parse a validated date value into a `Date` instance carrying, in its UTC
 * getters, the calendar day the value names in its own offset — or as UTC
 * when the value carries no offset at all. Never derives the day by
 * converting the value to UTC first, and never depends on the host machine's
 * local time zone.
 */
export function toDate(value: string | Date): Date {
	if (value instanceof Date) return value
	const parts = parseIsoParts(value)
	if (!parts) throw new Error(`Invalid date: cannot parse "${value}"`)
	return toUtcDate(parts)
}
