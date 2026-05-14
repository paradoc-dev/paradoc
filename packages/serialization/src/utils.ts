/**
 * Shared utility functions for validation and stringification
 */

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object'
}
