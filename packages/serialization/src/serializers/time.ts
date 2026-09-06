/**
 * Time serializer - validator and parsing helper for time-of-day values
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/

/**
 * Assert a time value is valid. Throws error if invalid.
 * Accepts `HH:MM` or `HH:MM:SS` (24-hour clock).
 */
export function assertTime(value: unknown): void {
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid time: must be a string, got ${typeof value}`)
	}
	if (!TIME_REGEX.test(value)) {
		throw new Error(`Invalid time: must be "HH:MM" or "HH:MM:SS", got "${value}"`)
	}
}

/** Parse a validated time-of-day string into a `Date` anchored to the UTC epoch date. */
export function toTimeOfDay(value: string): Date {
	const normalized = value.length === 5 ? `${value}:00` : value
	return new Date(`1970-01-01T${normalized}Z`)
}
