/**
 * Party serializer - validator for Party union type (Person | Organization)
 *
 * Note: The stringifier is defined in each registry (usa.ts, eu.ts, intl.ts)
 * because it depends on the person and organization stringifiers from that registry.
 */

import { isObject } from '../utils'

/**
 * Assert Party object is valid. Throws error if invalid.
 * Party is a union of Person | Organization.
 */
export function assertParty(value: unknown): void {
	if (value == null) return // null/undefined handled at stringifier level

	if (!isObject(value)) {
		throw new TypeError('Invalid party: must be a Party object')
	}

	// Party is a union, so we check if it matches either Person or Organization pattern
	const hasOrgFields =
		'legalName' in value ||
		'domicile' in value ||
		'entityType' in value ||
		'entityId' in value ||
		'taxId' in value
	const hasPersonFields = 'firstName' in value || 'lastName' in value || 'name' in value

	if (!hasPersonFields && !hasOrgFields) {
		throw new Error('Invalid party: must be either a Person or Organization')
	}
}
