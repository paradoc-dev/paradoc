import type { ParadocToolsConfig } from '../config'
import type { FillInput, FillOutput } from '../contracts'
import { artifactKind, contextSnapshot, errorList, formDraftPayload, asChecklistPayload, asFormPayload, makeResolver } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeFillInput } from '../input'
import { resolveSource } from '../resolve-source'

function contextOptions(value: unknown): { context?: import('@paradoc/core').RuntimeContextOptions } | undefined {
	const context = contextSnapshot(value)
	return context ? { context: { asOf: context.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined
}

export async function executeFill(
	input: FillInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<FillOutput> {
	const normalized = normalizeFillInput(input)
	try {
		const { isChecklist, isForm, loadFromObject } = await import('@paradoc/core')
		const { artifact, base_url } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)
		if (isForm(artifact)) {
			const instance = loadFromObject<'form'>(artifact, { resolver: makeResolver(base_url, config) })
			const result = instance.safeFill(asFormPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) {
				return {
					accepted: false,
					complete: false,
					artifact_kind: 'form',
					errors: errorList(result.error),
					error: errorFromUnknown(result.error, 'validation_error'),
				}
			}
			const draft = result.data
			return {
				accepted: true,
				complete: draft.isValid(),
				artifact_kind: 'form',
				data: formDraftPayload(draft),
				evaluation_context: contextSnapshot(draft.context),
			}
		}

		if (isChecklist(artifact)) {
			const instance = loadFromObject<'checklist'>(artifact, { resolver: makeResolver(base_url, config) })
			const result = instance.safeFill(asChecklistPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!result.success) {
				return {
					accepted: false,
					complete: false,
					artifact_kind: 'checklist',
					errors: errorList(result.error),
					error: errorFromUnknown(result.error, 'validation_error'),
				}
			}
			const draft = result.data
			return {
				accepted: true,
				complete: draft.isValid(),
				artifact_kind: 'checklist',
				data: asChecklistPayload(draft.getAllItems()),
				evaluation_context: contextSnapshot(draft.context),
			}
		}

		return {
			accepted: false,
			complete: false,
			...(kind ? { artifact_kind: kind as 'form' | 'checklist' } : {}),
			error: { code: 'unsupported_artifact', message: 'Only form and checklist artifacts support filling.' },
		}
	} catch (error) {
		return { accepted: false, complete: false, error: errorFromUnknown(error, 'fill_error') }
	}
}
