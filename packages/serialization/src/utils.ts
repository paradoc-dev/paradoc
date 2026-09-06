/**
 * Shared utility functions for validation and stringification
 */

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object'
}

/**
 * Assert a value is a finite number. Throws error if invalid.
 * `label` names the value in the thrown message (e.g. "number", "percentage").
 */
export function assertFiniteNumber(value: unknown, label: string): void {
	if (typeof value !== 'number') {
		throw new TypeError(`Invalid ${label}: must be a number, got ${typeof value}`)
	}
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid ${label}: must be a finite number`)
	}
}
