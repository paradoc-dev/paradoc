import type { ParadocToolsConfig } from '../config'
import type { RenderInput, RenderOutput } from '../contracts'
import { artifactKind, asChecklistPayload, asFormPayload, boundedPresentation, contextSnapshot, encodeOutput, errorList, makeResolver } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeRenderInput } from '../input'
import { resolveSource } from '../resolve-source'

function selectedLayer(artifact: Record<string, unknown>, requested: string | undefined): { key?: string; mime_type?: string; kind?: string } {
	const layers = artifact.layers && typeof artifact.layers === 'object' && !Array.isArray(artifact.layers)
		? artifact.layers as Record<string, Record<string, unknown>>
		: {}
	const key = requested ?? (typeof artifact.defaultLayer === 'string' ? artifact.defaultLayer : Object.keys(layers)[0])
	const layer = key ? layers[key] : undefined
	return { key, mime_type: typeof layer?.mimeType === 'string' ? layer.mimeType : undefined, kind: typeof layer?.kind === 'string' ? layer.kind : undefined }
}

function contextOptions(value: unknown): { context?: import('@paradoc/core').RuntimeContextOptions } | undefined {
	const context = contextSnapshot(value)
	return context ? { context: { asOf: context.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined
}

async function renderer() {
	const module = await import('@paradoc/render')
	return module.renderLayer()
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

function presentationWithConfig(input: RenderInput['presentation'], config: ParadocToolsConfig | undefined): RenderInput['presentation'] {
	if (input || config?.maxOutputBytes === undefined) return input
	return { max_bytes: config.maxOutputBytes, include_content: true }
}

export async function executeRender(
	input: RenderInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<RenderOutput> {
	const normalized = normalizeRenderInput(input)
	try {
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

		const layer = selectedLayer(artifact, normalized.layer)
		if (!layer.key) return { success: false, ...(kind ? { artifact_kind: kind } : {}), error: { code: 'missing_layer', message: 'Artifact has no renderable layers.' } }
		const renderOptions = { renderer: await renderer(), layer: layer.key }
		const resolver = makeResolver(base_url, config)

		if (isForm(artifact)) {
			const instance = loadFromObject<'form'>(artifact, { resolver })
			const result = instance.safeFill(asFormPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) return { success: false, artifact_kind: 'form', errors: errorList(result.error), error: errorFromUnknown(result.error, 'validation_error') }
			const content = await result.data.render(renderOptions)
			return outputResult('form', content, layer.mime_type, presentationWithConfig(normalized.presentation, config))
		}

		if (isDocument(artifact)) {
			const instance = loadFromObject<'document'>(artifact, { resolver })
			const content = await instance.render(renderOptions)
			return outputResult('document', content, layer.mime_type, presentationWithConfig(normalized.presentation, config))
		}

		if (isChecklist(artifact)) {
			const instance = loadFromObject<'checklist'>(artifact, { resolver })
			const result = instance.safeFill(asChecklistPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) return { success: false, artifact_kind: 'checklist', errors: errorList(result.error), error: errorFromUnknown(result.error, 'validation_error') }
			const content = await result.data.render(renderOptions)
			return outputResult('checklist', content, layer.mime_type, presentationWithConfig(normalized.presentation, config))
		}

		return { success: false, ...(kind ? { artifact_kind: kind } : {}), error: { code: 'unsupported_artifact', message: 'Rendering supports form, document, and checklist artifacts.' } }
	} catch (error) {
		return { success: false, error: errorFromUnknown(error, 'render_error') }
	}
}
