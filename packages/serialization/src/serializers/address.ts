/**
 * Address serializer - validator for postal addresses
 */

import { isObject } from '../utils'

/**
 * Assert Address object is valid. Throws error if invalid.
 */
export function assertAddress(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid address: must be an Address object')
	}
	const addr = value as Record<string, unknown>
	const hasField = !!(addr.line1 || addr.line2 || addr.locality || addr.region || addr.postalCode || addr.country)
	if (!hasField) {
		throw new Error('Invalid address: must have at least one field (line1, line2, locality, region, postalCode, or country)')
	}
}
