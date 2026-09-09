import type { ParadocToolsConfig } from '../config'
import type { InspectArtifactInput, InspectArtifactOutput } from '../contracts'
import { artifactKind, isRecord } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeInspectArtifactInput } from '../input'
import { resolveSource } from '../resolve-source'

type SectionName = 'metadata' | 'fields' | 'parties' | 'annexes' | 'items' | 'layers'

function boundedValue(value: unknown, max: number, depth = 0): unknown {
	if (depth >= 4) return '[nested value omitted]'
	if (Array.isArray(value)) return value.slice(0, max).map((entry) => boundedValue(entry, max, depth + 1))
	if (isRecord(value)) {
		return Object.fromEntries(Object.entries(value).slice(0, max).map(([key, entry]) => [key, boundedValue(entry, max, depth + 1)]))
	}
	return value
}

function entries(value: unknown, max: number): { value: unknown[]; truncated: boolean } {
	if (Array.isArray(value)) return { value: value.slice(0, max).map((entry) => boundedValue(entry, max)), truncated: value.length > max }
	if (isRecord(value)) {
		const values = Object.entries(value).slice(0, max).map(([id, definition]) => {
			const projection = boundedValue(definition, max)
			return { id, ...(isRecord(projection) ? projection : { value: projection }) }
		})
		return { value: values, truncated: Object.keys(value).length > max }
	}
	return { value: [], truncated: false }
}

function fieldSummary(definition: unknown, max: number, depth = 0): unknown {
	if (!isRecord(definition)) return definition
	const summary: Record<string, unknown> = {}
	for (const key of ['type', 'label', 'description', 'required', 'default', 'min', 'max', 'minLength', 'maxLength', 'enum', 'format', 'items']) {
		if (definition[key] !== undefined) summary[key] = boundedValue(definition[key], max, depth)
	}
	if (depth < 4 && isRecord(definition.fields)) {
		const fieldEntries = Object.entries(definition.fields).slice(0, max)
		summary.fields = Object.fromEntries(fieldEntries.map(([id, value]) => [id, fieldSummary(value, max, depth + 1)]))
		if (Object.keys(definition.fields).length > max) summary.fields_truncated = true
	}
	return summary
}

function inspectSections(artifact: Record<string, unknown>, requested: SectionName[], max: number): { sections: Record<string, unknown>; truncated: boolean } {
	let truncated = false
	const sections: Record<string, unknown> = {}
	for (const section of requested) {
		if (section === 'metadata') {
			sections.metadata = {
				name: artifact.name,
				version: artifact.version,
				title: artifact.title,
				description: artifact.description,
				code: artifact.code,
				language: artifact.language,
			}
			continue
		}
		if (section === 'fields') {
			const fields = isRecord(artifact.fields) ? Object.fromEntries(Object.entries(artifact.fields).slice(0, max).map(([id, value]) => [id, fieldSummary(value, max)])) : {}
			sections.fields = fields
			truncated ||= isRecord(artifact.fields) && Object.keys(artifact.fields).length > max
			continue
		}
		if (section === 'parties' || section === 'annexes') {
			const result = entries(artifact[section], max)
			sections[section] = result.value
			truncated ||= result.truncated
			continue
		}
		if (section === 'items') {
			const result = entries(artifact.items, max)
			sections.items = result.value
			truncated ||= result.truncated
			continue
		}
		const layerValue = isRecord(artifact.layers) ? artifact.layers : {}
		const result = entries(layerValue, max)
		sections.layers = result.value.map((entry) => {
			if (!isRecord(entry)) return entry
			const { id, kind, mimeType, path, title, description } = entry
			return { id, kind, mime_type: mimeType, path, title, description }
		})
		truncated ||= result.truncated
	}
	return { sections, truncated }
}

export async function executeInspectArtifact(
	input: InspectArtifactInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<InspectArtifactOutput> {
	const normalized = normalizeInspectArtifactInput(input)
	try {
		const { artifact } = await resolveSource(normalized, config)
		const sections = (normalized.sections ?? ['metadata', 'fields', 'parties', 'annexes', 'items', 'layers']) as SectionName[]
		const projection = inspectSections(artifact, sections, normalized.max_items ?? 100)
		return {
			artifact_kind: artifactKind(artifact),
			name: typeof artifact.name === 'string' ? artifact.name : undefined,
			version: typeof artifact.version === 'string' ? artifact.version : undefined,
			title: typeof artifact.title === 'string' ? artifact.title : undefined,
			description: typeof artifact.description === 'string' ? artifact.description : undefined,
			sections: projection.sections,
			truncated: projection.truncated,
		}
	} catch (error) {
		return { sections: {}, truncated: false, error: errorFromUnknown(error, 'inspect_error') }
	}
}
