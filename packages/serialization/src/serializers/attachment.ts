/**
 * Attachment serializer - validator and stringifier for attachment documents
 */

import type { Attachment } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Attachment object is valid. Throws error if invalid.
 */
function assertAttachment(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid attachment: must be an Attachment object')
	}
	const attachment = value as Record<string, unknown>

	if (!('name' in attachment)) {
		throw new Error('Invalid attachment: missing required property "name"')
	}
	if (typeof attachment.name !== 'string' || attachment.name === '') {
		throw new TypeError('Invalid attachment: "name" must be a non-empty string')
	}

	if (!('mimeType' in attachment)) {
		throw new Error('Invalid attachment: missing required property "mimeType"')
	}
	if (typeof attachment.mimeType !== 'string' || attachment.mimeType === '') {
		throw new TypeError('Invalid attachment: "mimeType" must be a non-empty string')
	}
}

/**
 * Attachment stringifier - reusable across all locales
 */
export const attachmentStringifier = {
	stringify(value: Attachment | Partial<Attachment>): string {
		if (value == null) throw new Error('Attachment value is required')

		assertAttachment(value)

		const attachment = value as Attachment
		return `${attachment.name} (${attachment.mimeType})`
	},
}
