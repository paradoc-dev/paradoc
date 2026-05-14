/**
 * Signature serializer - validator and stringifier for signature captures
 */

import type { Signature } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Signature object is valid. Throws error if invalid.
 */
function assertSignature(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid signature: must be a Signature object')
	}
	const signature = value as Record<string, unknown>

	if (!('timestamp' in signature)) {
		throw new Error('Invalid signature: missing required property "timestamp"')
	}
	if (typeof signature.timestamp !== 'string' || signature.timestamp === '') {
		throw new TypeError('Invalid signature: "timestamp" must be a non-empty string')
	}

	if (!('method' in signature)) {
		throw new Error('Invalid signature: missing required property "method"')
	}
	const validMethods = ['drawn', 'typed', 'uploaded', 'certificate']
	if (typeof signature.method !== 'string' || !validMethods.includes(signature.method)) {
		throw new TypeError('Invalid signature: "method" must be one of: drawn, typed, uploaded, certificate')
	}
}

/**
 * Signature stringifier - reusable across all locales
 */
export const signatureStringifier = {
	stringify(value: Signature | Partial<Signature>): string {
		if (value == null) throw new Error('Signature value is required')

		assertSignature(value)

		const signature = value as Signature
		const parts: string[] = []

		// Add signature type if specified
		if (signature.type) {
			parts.push(signature.type === 'initials' ? 'Initials' : 'Signature')
		} else {
			parts.push('Signature')
		}

		// Add method
		parts.push(`(${signature.method})`)

		// Format timestamp
		const date = new Date(signature.timestamp)
		if (!isNaN(date.getTime())) {
			parts.push(`on ${date.toISOString().split('T')[0]}`)
		}

		return parts.join(' ')
	},
}
