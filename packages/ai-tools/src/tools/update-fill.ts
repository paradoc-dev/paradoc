import type { ParadocToolsConfig } from '../config'
import type { UpdateFillInput, UpdateFillOutput } from '../contracts'
import { artifactKind, asChecklistPayload, asFormPayload, contextSnapshot, errorList, formDraftPayload, makeResolver } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeUpdateFillInput } from '../input'
import { resolveSource } from '../resolve-source'

function contextOptions(value: unknown): { context?: import('@paradoc/core').RuntimeContextOptions } | undefined {
	const context = contextSnapshot(value)
	return context ? { context: { asOf: context.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined
}

type FormDraftLike = {
	safeUpdate: (patch: never, options: object) => { success: true; data: FormDraftLike } | { success: false; error: Error }
	clear: (path: string) => FormDraftLike
	reset: (path: string) => FormDraftLike
	isValid: () => boolean
	fields: Record<string, unknown>
	parties: Record<string, unknown>
	annexes: Record<string, unknown>
	signers: Record<string, unknown>
	signatories: Record<string, unknown>
	context: unknown
}

export async function executeUpdateFill(
	input: UpdateFillInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<UpdateFillOutput> {
	const normalized = normalizeUpdateFillInput(input)
	try {
		const { isChecklist, isForm, loadFromObject } = await import('@paradoc/core')
		const { artifact, base_url } = await resolveSource(normalized, config)
		if (isForm(artifact)) {
			const instance = loadFromObject<'form'>(artifact, { resolver: makeResolver(base_url, config) })
			const initial = instance.safeFill(asFormPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!initial.success) return { accepted: false, complete: false, artifact_kind: 'form', errors: errorList(initial.error), error: errorFromUnknown(initial.error, 'validation_error') }
			let draft = initial.data as unknown as FormDraftLike
			if (normalized.patch !== undefined) {
				const updated = draft.safeUpdate(asFormPayload(normalized.patch) as never, {})
				if (!updated.success) return { accepted: false, complete: false, artifact_kind: 'form', errors: errorList(updated.error), error: errorFromUnknown(updated.error, 'validation_error') }
				draft = updated.data
			}
			for (const path of normalized.clear ?? []) draft = draft.clear(path as never)
			for (const path of normalized.reset ?? []) draft = draft.reset(path as never)
			return { accepted: true, complete: draft.isValid(), artifact_kind: 'form', data: formDraftPayload(draft), evaluation_context: contextSnapshot(draft.context) }
		}

		if (isChecklist(artifact)) {
			const instance = loadFromObject<'checklist'>(artifact, { resolver: makeResolver(base_url, config) })
			const initial = instance.safeFill(asChecklistPayload(normalized.data) as never, contextOptions(normalized.evaluation_context))
			if (!initial.success) return { accepted: false, complete: false, artifact_kind: 'checklist', errors: errorList(initial.error), error: errorFromUnknown(initial.error, 'validation_error') }
			let draft = initial.data
			if (normalized.patch !== undefined) {
				const updated = draft.safeUpdate(asChecklistPayload(normalized.patch), {})
				if (!updated.success) return { accepted: false, complete: false, artifact_kind: 'checklist', errors: errorList(updated.error), error: errorFromUnknown(updated.error, 'validation_error') }
				draft = updated.data
			}
			for (const path of normalized.clear ?? []) draft = draft.clear(path as never)
			for (const path of normalized.reset ?? []) draft = draft.reset(path as never)
			return { accepted: true, complete: draft.isValid(), artifact_kind: 'checklist', data: asChecklistPayload(draft.getAllItems()), evaluation_context: contextSnapshot(draft.context) }
		}

		const kind = artifactKind(artifact)
		return { accepted: false, complete: false, ...(kind === 'form' || kind === 'checklist' ? { artifact_kind: kind } : {}), error: { code: 'unsupported_artifact', message: 'Only form and checklist artifacts support updates.' } }
	} catch (error) {
		return { accepted: false, complete: false, error: errorFromUnknown(error, 'update_error') }
	}
}
