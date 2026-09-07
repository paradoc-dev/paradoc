import type { Bindings } from '@paradoc/types'
import { getPath } from '../path'

export function applyBindings(data: Record<string, unknown>, bindings: Bindings): Record<string, unknown> {
	const result = { ...data }
	for (const [templateKey, sourcePath] of Object.entries(bindings)) {
		const normalizedPath = sourcePath.startsWith('fields.') ? sourcePath.slice('fields.'.length) : sourcePath
		result[templateKey] = getPath(data, normalizedPath)
	}
	return result
}
