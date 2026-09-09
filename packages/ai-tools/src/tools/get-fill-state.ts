import type { ParadocToolsConfig } from '../config'
import type { FillStateInput, FillStateOutput } from '../contracts'
import { artifactKind, asChecklistPayload, asFormPayload, contextSnapshot, makeResolver } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeFillStateInput } from '../input'
import { resolveSource } from '../resolve-source'

function stateOutput(kind: 'form' | 'checklist', state: {
	phase: string
	summary: { requiredTotal: number; requiredDone: number; requiredRemaining: number; completionPercent: number }
	defsValues?: Record<string, unknown>
	rules: { valid: boolean; errors: string[]; warnings: string[] }
	openRequired: unknown[]
	openOptional: unknown[]
	blocked: unknown[]
	done: unknown[]
	candidates: unknown[]
	next: unknown
}, context: unknown): FillStateOutput {
	return {
		artifact_kind: kind,
		phase: state.phase,
		summary: {
			required_total: state.summary.requiredTotal,
			required_done: state.summary.requiredDone,
			required_remaining: state.summary.requiredRemaining,
			completion_percent: state.summary.completionPercent,
		},
		...(state.defsValues ? { defs_values: structuredClone(state.defsValues) } : {}),
		rules: structuredClone(state.rules),
		open_required: structuredClone(state.openRequired),
		open_optional: structuredClone(state.openOptional),
		blocked: structuredClone(state.blocked),
		done: structuredClone(state.done),
		candidates: structuredClone(state.candidates),
		next: structuredClone(state.next),
		evaluation_context: contextSnapshot(context),
	}
}

export async function executeGetFillState(
	input: FillStateInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<FillStateOutput> {
	const normalized = normalizeFillStateInput(input)
	try {
		const { isChecklist, isForm, loadFromObject } = await import('@paradoc/core')
		const { artifact, base_url } = await resolveSource(normalized, config)
		if (isForm(artifact)) {
			const instance = loadFromObject<'form'>(artifact, { resolver: makeResolver(base_url, config) })
			const runtimeContext = contextSnapshot(normalized.evaluation_context)
			const result = instance.safeFill(asFormPayload(normalized.data) as never, runtimeContext ? { context: { asOf: runtimeContext.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined)
			if (!result.success) return { artifact_kind: 'form', phase: 'draft', summary: { required_total: 0, required_done: 0, required_remaining: 0, completion_percent: 0 }, rules: { valid: false, errors: [], warnings: [] }, open_required: [], open_optional: [], blocked: [], done: [], candidates: [], next: null, errors: [{ code: 'validation_error', message: result.error.message }] }
			const state = result.data.getFillState({ includeOptional: normalized.include_optional })
			return stateOutput('form', state, result.data.context)
		}
		if (isChecklist(artifact)) {
			const instance = loadFromObject<'checklist'>(artifact, { resolver: makeResolver(base_url, config) })
			const runtimeContext = contextSnapshot(normalized.evaluation_context)
			const result = instance.safeFill(asChecklistPayload(normalized.data) as never, runtimeContext ? { context: { asOf: runtimeContext.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined)
			if (!result.success) return { artifact_kind: 'checklist', phase: 'draft', summary: { required_total: 0, required_done: 0, required_remaining: 0, completion_percent: 0 }, rules: { valid: false, errors: [], warnings: [] }, open_required: [], open_optional: [], blocked: [], done: [], candidates: [], next: null, errors: [{ code: 'validation_error', message: result.error.message }] }
			return stateOutput('checklist', result.data.getFillState(), result.data.context)
		}
		const kind = artifactKind(artifact)
		return {
			artifact_kind: (kind === 'checklist' ? 'checklist' : 'form'),
			phase: 'unsupported',
			summary: { required_total: 0, required_done: 0, required_remaining: 0, completion_percent: 0 },
			rules: { valid: false, errors: ['Only form and checklist artifacts support fill state.'], warnings: [] },
			open_required: [], open_optional: [], blocked: [], done: [], candidates: [], next: null,
			errors: [{ code: 'unsupported_artifact', message: 'Only form and checklist artifacts support fill state.' }],
		}
	} catch (error) {
		return {
			artifact_kind: 'form',
			phase: 'error',
			summary: { required_total: 0, required_done: 0, required_remaining: 0, completion_percent: 0 },
			rules: { valid: false, errors: [], warnings: [] },
			open_required: [], open_optional: [], blocked: [], done: [], candidates: [], next: null,
			error: errorFromUnknown(error, 'fill_state_error'),
		}
	}
}
