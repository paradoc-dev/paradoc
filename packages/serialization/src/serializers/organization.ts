/**
 * Organization serializer - validator for organization information
 */

import type { Organization } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Organization object is valid. Throws error if invalid.
 */
export function assertOrganization(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid organization: must be an Organization object')
	}
	if (!('name' in value)) {
		throw new Error('Invalid organization: missing required property "name"')
	}
	const name = (value as Record<string, unknown>).name
	if (typeof name !== 'string') {
		throw new TypeError(`Invalid organization: "name" must be a string, got ${typeof name}`)
	}
	if (name === '') {
		throw new Error('Invalid organization: "name" cannot be empty')
	}
}

/**
 * Organization stringifier - reusable across all locales (same format)
 */
export const organizationStringifier = {
	stringify(
		value: Organization | Partial<Organization>,
		fallback = ''
	): string {
		if (value == null) return fallback

		assertOrganization(value)

		const parts: string[] = []

		if ((value as Organization).name) parts.push((value as Organization).name)

		const details: string[] = []
		if ((value as Organization).taxId) details.push(`Tax ID: ${(value as Organization).taxId}`)

		if (details.length > 0) {
			parts.push(`(${details.join(', ')})`)
		}

		return parts.join(' ') || fallback
	},
}
