import type { ParadocToolsConfig } from '../config'
import type { ValidateInputOutput, ValidateInputValue } from '../contracts'
import { artifactKind } from '../artifact'
import { errorFromUnknown, toolError } from '../errors'
import { normalizeValidateInput } from '../input'
import { resolveSource } from '../resolve-source'

function coreErrors(value: unknown) {
	if (!Array.isArray(value)) return [toolError('validation_error', 'Input was rejected by the artifact schema')]
	return value.map((entry) => {
		const issue = entry as { field?: unknown; message?: unknown }
		return toolError(
			'validation_error',
			typeof issue.message === 'string' ? issue.message : String(entry),
			typeof issue.field === 'string' ? issue.field.split('.') : undefined,
		)
	})
}

function failure(input: ValidateInputValue, kind: ReturnType<typeof artifactKind> | undefined, message: string, path?: string): ValidateInputOutput {
	return {
		valid: false,
		target: input.target,
		...(kind ? { artifact_kind: kind } : {}),
		errors: [toolError('invalid_target', message, path ? path.split('.') : undefined)],
	}
}

export async function executeValidateInput(
	input: ValidateInputValue | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<ValidateInputOutput> {
	const normalized = normalizeValidateInput(input)
	try {
		const { isChecklist, isForm, loadFromObject } = await import('@paradoc/core')
		const { artifact } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)

		if (normalized.target === 'field') {
			if (!isForm(artifact)) return failure(normalized, kind, 'Target "field" requires a form artifact.')
			if (!normalized.field_path?.trim()) return failure(normalized, 'form', 'field_path is required for target "field".', 'field_path')
			const result = loadFromObject<'form'>(artifact).validateFieldInput({
				fieldPath: normalized.field_path,
				value: normalized.value,
			})
			return result.success
				? { valid: true, target: normalized.target, artifact_kind: 'form', normalized_value: result.value }
				: { valid: false, target: normalized.target, artifact_kind: 'form', errors: coreErrors(result.errors) }
		}

		if (normalized.target === 'party') {
			if (!isForm(artifact)) return failure(normalized, kind, 'Target "party" requires a form artifact.')
			if (!normalized.role_id?.trim()) return failure(normalized, 'form', 'role_id is required for target "party".', 'role_id')
			const result = loadFromObject<'form'>(artifact).validatePartyInput({
				roleId: normalized.role_id,
				index: normalized.index,
				value: normalized.value,
			})
			return result.success
				? { valid: true, target: normalized.target, artifact_kind: 'form', normalized_value: result.value }
				: { valid: false, target: normalized.target, artifact_kind: 'form', errors: coreErrors(result.errors) }
		}

		if (normalized.target === 'annex') {
			if (!isForm(artifact)) return failure(normalized, kind, 'Target "annex" requires a form artifact.')
			if (!normalized.annex_id?.trim()) return failure(normalized, 'form', 'annex_id is required for target "annex".', 'annex_id')
			const result = loadFromObject<'form'>(artifact).validateAnnexInput({ annexId: normalized.annex_id, value: normalized.value })
			return result.success
				? { valid: true, target: normalized.target, artifact_kind: 'form', normalized_value: result.value }
				: { valid: false, target: normalized.target, artifact_kind: 'form', errors: coreErrors(result.errors) }
		}

		if (!isChecklist(artifact)) return failure(normalized, kind, 'Target "checklist_item" requires a checklist artifact.')
		if (!normalized.item_id?.trim()) return failure(normalized, 'checklist', 'item_id is required for target "checklist_item".', 'item_id')
		const result = loadFromObject<'checklist'>(artifact).validateItemInput({ itemId: normalized.item_id, value: normalized.value })
		return result.success
			? { valid: true, target: normalized.target, artifact_kind: 'checklist', normalized_value: result.value }
			: { valid: false, target: normalized.target, artifact_kind: 'checklist', errors: coreErrors(result.errors) }
	} catch (error) {
		return { valid: false, target: normalized.target, error: errorFromUnknown(error, 'validation_error') }
	}
}
