/**
 * Phone serializer - validator and stringifier for phone numbers
 */

import type { Phone } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Phone object or string is valid. Throws error if invalid.
 */
function assertPhone(value: unknown): void {
	if (typeof value === 'string') {
		if (!value.startsWith('+') || value.length < 7) {
			throw new Error('Invalid phone: string must be in E.164 format (e.g., "+12125551234")')
		}
		return
	}
	if (!isObject(value)) {
		throw new TypeError('Invalid phone: must be a string or Phone object')
	}
	const phone = value as Record<string, unknown>
	if (typeof phone.number !== 'string') {
		throw new TypeError('Invalid phone: "number" must be a string')
	}
	if (!phone.number.startsWith('+') || phone.number.length < 7) {
		throw new Error('Invalid phone: "number" must be in E.164 format (e.g., "+12125551234")')
	}
}

/**
 * Phone stringifier - reusable across all locales (same format)
 */
export const phoneStringifier = {
	stringify(
		value: Phone | string | Partial<Phone>,
		fallback = ''
	): string {
		if (value == null) return fallback

		if (typeof value === 'string') {
			assertPhone(value)
			return value
		}

		assertPhone(value)

		const parts: string[] = []
		const phoneNumber = (value as Phone).number

		if (phoneNumber && phoneNumber.startsWith('+')) {
			parts.push(phoneNumber)
		}

		if ((value as Phone).extension) {
			parts.push(`ext. ${(value as Phone).extension}`)
		}

		return parts.join(' ') || fallback
	},
}
