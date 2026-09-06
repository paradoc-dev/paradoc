/**
 * Percentage serializer - validator for percentage values.
 *
 * Percentage values sit on the framework's existing 0-100 scale (8.25 means
 * "8.25%"), matching `@paradoc/core`'s `percentage` primitive and the
 * `percentage` form field. The serializer only checks the value is a finite
 * number: it applies no range check of its own, so a value outside 0-100 (or
 * negative, which the primitive allows by default) still stringifies — any
 * `min`/`max` constraint is the field definition's concern, not the
 * serializer's.
 */

import { assertFiniteNumber } from '../utils'

/**
 * Assert a percentage value is valid. Throws error if invalid.
 */
export function assertPercentageValue(value: unknown): void {
	assertFiniteNumber(value, 'percentage')
}
