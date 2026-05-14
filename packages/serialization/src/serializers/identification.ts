/**
 * Identification serializer - validator and stringifier for identification documents
 */

import type { Identification } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Identification object is valid. Throws error if invalid.
 */
function assertIdentification(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid identification: must be an Identification object')
	}
	const id = value as Record<string, unknown>

	if (!('type' in id)) {
		throw new Error('Invalid identification: missing required property "type"')
	}
	if (typeof id.type !== 'string' || id.type === '') {
		throw new TypeError('Invalid identification: "type" must be a non-empty string')
	}

	if (!('number' in id)) {
		throw new Error('Invalid identification: missing required property "number"')
	}
	if (typeof id.number !== 'string' || id.number === '') {
		throw new TypeError('Invalid identification: "number" must be a non-empty string')
	}
}

/**
 * Identification stringifier - reusable across all locales
 */
export const identificationStringifier = {
	stringify(value: Identification | Partial<Identification>, fallback = ''): string {
		if (value == null) return fallback

		assertIdentification(value)

		const id = value as Identification
		const parts: string[] = [`${id.type}: ${id.number}`]

		if (id.issuer || id.issueDate || id.expiryDate) {
			const details: string[] = []

			if (id.issuer) {
				details.push(id.issuer)
			}

			if (id.issueDate) {
				details.push(`issued ${id.issueDate}`)
			}

			if (id.expiryDate) {
				details.push(`expires ${id.expiryDate}`)
			}

			if (details.length > 0) {
				parts.push(`(${details.join(', ')})`)
			}
		}

		return parts.join(' ')
	},
}
