import type { ParadocToolsConfig } from '../config'
import { RenderInputSchema, type RenderInput, type RenderOutput } from '../contracts'
import { artifactKind, asChecklistPayload, asFormPayload, boundedPresentation, contextOptions, encodeOutput, makeResolver } from '../artifact'
import { errorFromUnknown, validationErrors } from '../errors'
import { resolveSource } from '../resolve-source'

function selectedLayer(artifact: Record<string, unknown>, requested: string | undefined): { key?: string; mime_type?: string; kind?: string } {
	const layers = artifact.layers && typeof artifact.layers === 'object' && !Array.isArray(artifact.layers)
		? artifact.layers as Record<string, Record<string, unknown>>
		: {}
	const key = requested ?? (typeof artifact.defaultLayer === 'string' ? artifact.defaultLayer : Object.keys(layers)[0])
	const layer = key ? layers[key] : undefined
	return { key, mime_type: typeof layer?.mimeType === 'string' ? layer.mimeType : undefined, kind: typeof layer?.kind === 'string' ? layer.kind : undefined }
}

function hasValues(value: unknown): boolean {
	if (value === null || value === undefined) return false
	if (Array.isArray(value)) return value.some(hasValues)
	if (typeof value === 'object') return Object.values(value).some(hasValues)
	return value !== ''
}

/**
 * A form or checklist render with no values produces a blank file that looks
 * like success. When data was lost on the way (a model sent null, or a schema
 * layer closed the object), that hides the loss, so the caller must ask for a
 * blank copy explicitly.
 */
function missingData(artifact_kind: 'form' | 'checklist'): RenderOutput {
	return {
		success: false,
		artifact_kind,
		error: {
			code: 'missing_data',
			message: `No values to render: data is missing or empty. Pass the ${artifact_kind}'s values in data (for example the data from fill), or set blank to true for a blank copy.`,
		},
	}
}

async function renderer() {
	const module = await import('@paradoc/render')
	return module.createLayerRenderer()
}

function outputResult(
	artifact_kind: 'form' | 'document' | 'checklist',
	value: string | Uint8Array,
	mime_type: string | undefined,
	presentation: RenderInput['presentation'],
): RenderOutput {
	const encoded = encodeOutput(value)
	const bounded = boundedPresentation(encoded, presentation)
	return {
		success: true,
		artifact_kind,
		encoding: encoded.encoding,
		mime_type,
		byte_length: encoded.byte_length,
		...bounded,
	}
}

export async function executeRender(
	input: RenderInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<RenderOutput> {
	try {
		const normalized = RenderInputSchema.parse(input)
		const { isChecklist, isDocument, isForm, loadFromObject, validate } = await import('@paradoc/core')
		const { artifact, base_url } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)
		const validation = validate(artifact)
		if (validation.issues) {
			return {
				success: false,
				...(kind ? { artifact_kind: kind } : {}),
				validation_issues: validation.issues.map((issue) => ({ message: issue.message, path: issue.path as Array<string | number> | undefined })),
				error: { code: 'invalid_artifact', message: 'Artifact failed schema validation.' },
			}
		}
		if (kind === 'bundle') {
			return { success: false, artifact_kind: kind, error: { code: 'unsupported_artifact', message: 'Rendering supports form, document, and checklist artifacts.' } }
		}

		const layer = selectedLayer(artifact, normalized.layer)
		if (!layer.key) return { success: false, ...(kind ? { artifact_kind: kind } : {}), error: { code: 'missing_layer', message: 'Artifact has no renderable layers.' } }
		const renderOptions = { renderer: await renderer(), layer: layer.key }
		const resolver = makeResolver(base_url, config)

		if (isForm(artifact)) {
			if (!normalized.blank && !hasValues(normalized.data)) return missingData('form')
			const instance = loadFromObject<'form'>(artifact, { resolver })
			const result = instance.safeFill(asFormPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) return { success: false, artifact_kind: 'form', errors: validationErrors(result.error), error: errorFromUnknown(result.error, 'validation_error') }
			const content = await result.data.render(renderOptions)
			return outputResult('form', content, layer.mime_type, normalized.presentation)
		}

		if (isDocument(artifact)) {
			const instance = loadFromObject<'document'>(artifact, { resolver })
			const content = await instance.render(renderOptions)
			return outputResult('document', content, layer.mime_type, normalized.presentation)
		}

		if (isChecklist(artifact)) {
			if (!normalized.blank && !hasValues(normalized.data)) return missingData('checklist')
			const instance = loadFromObject<'checklist'>(artifact, { resolver })
			const result = instance.safeFill(asChecklistPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) return { success: false, artifact_kind: 'checklist', errors: validationErrors(result.error), error: errorFromUnknown(result.error, 'validation_error') }
			const content = await result.data.render(renderOptions)
			return outputResult('checklist', content, layer.mime_type, normalized.presentation)
		}

		return { success: false, ...(kind ? { artifact_kind: kind } : {}), error: { code: 'unsupported_artifact', message: 'Rendering supports form, document, and checklist artifacts.' } }
	} catch (error) {
		return { success: false, error: errorFromUnknown(error, 'render_error') }
	}
}
