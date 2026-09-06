/**
 * Number serializer - validator for plain numeric values
 */

import { assertFiniteNumber } from '../utils'

/**
 * Assert a number value is valid. Throws error if invalid.
 */
export function assertNumberValue(value: unknown): void {
	assertFiniteNumber(value, 'number')
}
