/**
 * Person serializer - validator for person information
 */

import type { Person } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Person object is valid. Throws error if invalid.
 */
export function assertPerson(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid person: must be a Person object')
	}
	const person = value as Record<string, unknown>
	const hasName = !!(person.name || person.firstName || person.lastName)
	if (!hasName) {
		throw new Error('Invalid person: must have at least one name field (name, firstName, or lastName)')
	}
}

/**
 * Person stringifier - reusable across all locales (same format)
 */
export const personStringifier = {
	stringify(
		value: Person | Partial<Person>,
		fallback = ''
	): string {
		if (value == null) return fallback

		assertPerson(value)

		if (value.name) return value.name

		const nameParts: string[] = []
		if (value.title) nameParts.push(value.title)
		if (value.firstName) nameParts.push(value.firstName)
		if (value.middleName) nameParts.push(value.middleName)
		if (value.lastName) nameParts.push(value.lastName)
		if (value.suffix) nameParts.push(value.suffix)

		const result = nameParts.join(' ')
		if (!result) throw new Error('At least one name component is required')
		return result
	},
}
