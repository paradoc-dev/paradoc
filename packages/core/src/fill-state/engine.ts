/**
 * Fill-state engine — dependency extraction and state computation.
 *
 * Two responsibilities:
 * A. Static dependency extraction from form definition expressions
 * B. Runtime state computation from form + current data
 */

import type { Form, FormField, FieldsetField, FormParty, FormAnnex } from '@paradoc/types'
import type {
	FillTarget,
	FillTargetKind,
	FillTargetOptions,
	FillItemState,
	FillState,
} from './types'
import type { FormRuntimeState } from '@/logic/runtime/evaluation/types'
import { parseExpression } from '@/logic/design-time/validation/expression-parser'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import { evaluateFormRules } from '@/logic/runtime/evaluation/rule-evaluator'
import type { EvaluationContext } from '@/logic/runtime/evaluation/types'

/** Known function names that should not be treated as field dependencies */
const KNOWN_FUNCTIONS = new Set([
	'partyCount',
	'signedCount',
	'allSigned',
	'anySigned',
	'partyType',
	'witnessCount',
	'allWitnessesSigned',
	'anyWitnessSigned',
])

// ============================================================================
// A. Dependency Extraction (static, from form definition)
// ============================================================================

/**
 * Extracts variables from a conditional expression (visible/required).
 * Filters out known functions and maps `fields.X` → `X`.
 */
function extractDependencies(expr: boolean | string | undefined): string[] {
	if (typeof expr !== 'string') return []

	const result = parseExpression(expr)
	if (!result.success) return []

	const deps: string[] = []
	for (const v of result.variables) {
		if (KNOWN_FUNCTIONS.has(v)) continue
		// Strip `fields.` prefix to get raw field id
		if (v.startsWith('fields.')) {
			deps.push(v.slice(7))
		} else {
			// Could be a defs key or bare field ref
			deps.push(v)
		}
	}
	return deps
}

/**
 * Builds a dependency map: targetId → Set of field/def ids it depends on for visibility.
 * Only visibility expressions matter for "blocked" computation.
 */
export function buildDependencyMap(form: Form): Map<string, Set<string>> {
	const deps = new Map<string, Set<string>>()

	// Walk fields (including nested fieldsets)
	function walkFields(fields: Record<string, FormField> | undefined, prefix: string = '') {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = prefix ? `${prefix}.${fieldId}` : fieldId
			const visibleDeps = extractDependencies(field.visible)
			if (visibleDeps.length > 0) {
				deps.set(fullId, new Set(visibleDeps))
			}
			if (field.type === 'fieldset') {
				walkFields((field as FieldsetField).fields, fullId)
			}
		}
	}

	walkFields(form.fields)

	// Walk annexes
	if (form.annexes) {
		for (const [annexId, annex] of Object.entries(form.annexes)) {
			const visibleDeps = extractDependencies(annex.visible)
			if (visibleDeps.length > 0) {
				deps.set(annexId, new Set(visibleDeps))
			}
		}
	}

	return deps
}

// ============================================================================
// B. State Computation (runtime, from form + current data)
// ============================================================================

/** Check if a value counts as "filled" */
function isFilled(value: unknown): boolean {
	return value !== null && value !== undefined
}

/** Check if a party role is filled (has at least one party) */
function isPartyFilled(parties: Record<string, unknown>, roleId: string): boolean {
	const val = parties[roleId]
	if (val === null || val === undefined) return false
	if (Array.isArray(val)) return val.length > 0
	return true
}

/** Check if an annex is filled */
function isAnnexFilled(annexes: Record<string, unknown>, annexId: string): boolean {
	return isFilled(annexes[annexId])
}

/**
 * Build the set of all unfilled item ids (fields, parties, annexes).
 */
function getUnfilledIds(
	form: Form,
	fieldValues: Record<string, unknown>,
	partyValues: Record<string, unknown>,
	annexValues: Record<string, unknown>,
): Set<string> {
	const unfilled = new Set<string>()

	// Fields
	function walkFieldIds(fields: Record<string, FormField> | undefined, data: Record<string, unknown> | undefined, prefix: string = '') {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = prefix ? `${prefix}.${fieldId}` : fieldId
			const value = data?.[fieldId]
			if (!isFilled(value)) {
				unfilled.add(fullId)
			}
			if (field.type === 'fieldset') {
				const nested = typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
				walkFieldIds((field as FieldsetField).fields, nested, fullId)
			}
		}
	}
	walkFieldIds(form.fields, fieldValues)

	// Parties
	if (form.parties) {
		for (const roleId of Object.keys(form.parties)) {
			if (!isPartyFilled(partyValues, roleId)) {
				unfilled.add(roleId)
			}
		}
	}

	// Annexes
	if (form.annexes) {
		for (const annexId of Object.keys(form.annexes)) {
			if (!isAnnexFilled(annexValues, annexId)) {
				unfilled.add(annexId)
			}
		}
	}

	return unfilled
}

/**
 * Computes the FillState for a draft form.
 */
export function computeFillState(
	form: Form,
	fieldValues: Record<string, unknown>,
	partyValues: Record<string, unknown>,
	annexValues: Record<string, unknown>,
	runtimeState: FormRuntimeState,
	options?: FillTargetOptions,
): FillState {
	const requiredFirst = options?.requiredFirst !== false
	const includeOptional = options?.includeOptional === true

	const depMap = buildDependencyMap(form)
	const unfilledIds = getUnfilledIds(form, fieldValues, partyValues, annexValues)

	const openRequired: FillItemState[] = []
	const openOptional: FillItemState[] = []
	const blocked: FillItemState[] = []
	const done: FillItemState[] = []

	let order = 0

	// --- Parties first ---
	if (form.parties) {
		for (const [roleId, partyDef] of Object.entries(form.parties)) {
			const filled = isPartyFilled(partyValues, roleId)
			const required = partyDef.required === true || (typeof partyDef.required === 'string' ? true : (partyDef.min ?? 1) > 0)
			const item: FillItemState = {
				kind: 'party',
				key: roleId,
				required,
				order: order++,
				visible: true, // parties are always visible
				filled,
				blockedBy: [],
			}

			if (filled) {
				done.push(item)
			} else {
				if (required) {
					openRequired.push(item)
				} else {
					openOptional.push(item)
				}
			}
		}
	}

	// --- Fields ---
	function walkFieldsForState(
		fields: Record<string, FormField> | undefined,
		data: Record<string, unknown> | undefined,
		prefix: string = '',
	) {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = prefix ? `${prefix}.${fieldId}` : fieldId
			const value = data?.[fieldId]
			const filled = isFilled(value)

			const fieldState = runtimeState.fields.get(fullId)
			const visible = fieldState?.visible ?? true
			const isRequired = fieldState?.required ?? false

			// Compute blockedBy: visibility deps that are unfilled
			const visibilityDeps = depMap.get(fullId)
			const blockedBy: string[] = []
			if (visibilityDeps) {
				for (const dep of visibilityDeps) {
					if (unfilledIds.has(dep)) {
						blockedBy.push(dep)
					}
				}
			}

			const item: FillItemState = {
				kind: 'field',
				key: fullId,
				required: isRequired,
				order: order++,
				visible,
				filled,
				blockedBy,
			}

			if (filled) {
				done.push(item)
			} else if (!visible && blockedBy.length > 0) {
				blocked.push(item)
			} else if (visible && isRequired) {
				openRequired.push(item)
			} else if (visible && !isRequired) {
				openOptional.push(item)
			} else if (!visible) {
				// Not visible and no blocked dependencies — effectively blocked without known cause
				blocked.push(item)
			}

			// Recurse into fieldsets
			if (field.type === 'fieldset') {
				const nested = typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
				walkFieldsForState((field as FieldsetField).fields, nested, fullId)
			}
		}
	}
	walkFieldsForState(form.fields, fieldValues)

	// --- Annexes ---
	if (form.annexes) {
		for (const [annexId, annexDef] of Object.entries(form.annexes)) {
			const filled = isAnnexFilled(annexValues, annexId)
			const annexState = runtimeState.annexes.get(annexId)
			const visible = annexState?.visible ?? true
			const isRequired = annexState?.required ?? false

			const visibilityDeps = depMap.get(annexId)
			const blockedBy: string[] = []
			if (visibilityDeps) {
				for (const dep of visibilityDeps) {
					if (unfilledIds.has(dep)) {
						blockedBy.push(dep)
					}
				}
			}

			const item: FillItemState = {
				kind: 'annex',
				key: annexId,
				required: isRequired,
				order: order++,
				visible,
				filled,
				blockedBy,
			}

			if (filled) {
				done.push(item)
			} else if (!visible && blockedBy.length > 0) {
				blocked.push(item)
			} else if (visible && isRequired) {
				openRequired.push(item)
			} else if (visible && !isRequired) {
				openOptional.push(item)
			} else if (!visible) {
				blocked.push(item)
			}
		}
	}

	// --- Summary ---
	const allRequired = [...openRequired, ...done.filter(d => d.required), ...blocked.filter(b => b.required)]
	const requiredTotal = allRequired.length
	const requiredDone = done.filter(d => d.required).length
	const requiredRemaining = requiredTotal - requiredDone
	const completionPercent = requiredTotal === 0 ? 100 : Math.round((requiredDone / requiredTotal) * 100)

	// --- Rules ---
	const context: EvaluationContext = { fields: {} }
	for (const [fieldId, value] of Object.entries(fieldValues)) {
		context.fields[fieldId] = value
	}
	const ruleResult = evaluateFormRules(form, fieldValues, runtimeState.defsValues, context)

	// --- Defs values ---
	const defsValues: Record<string, unknown> = {}
	for (const [k, v] of runtimeState.defsValues) {
		defsValues[k] = v
	}

	// --- Candidates ---
	const candidates: FillTarget[] = []

	if (requiredFirst) {
		for (const item of openRequired) {
			candidates.push({ kind: item.kind, key: item.key, required: item.required, order: item.order })
		}
		if (includeOptional) {
			for (const item of openOptional) {
				candidates.push({ kind: item.kind, key: item.key, required: item.required, order: item.order })
			}
		}
	} else {
		// Interleave by declaration order
		const combined = includeOptional ? [...openRequired, ...openOptional] : [...openRequired]
		combined.sort((a, b) => a.order - b.order)
		for (const item of combined) {
			candidates.push({ kind: item.kind, key: item.key, required: item.required, order: item.order })
		}
	}

	return {
		phase: 'draft',
		summary: {
			requiredTotal,
			requiredDone,
			requiredRemaining,
			completionPercent,
		},
		defsValues,
		rules: {
			valid: ruleResult.valid,
			errors: ruleResult.errors.map(e => e.message ?? `Rule ${e.ruleId} failed`),
			warnings: ruleResult.warnings.map(w => w.message ?? `Rule ${w.ruleId} warning`),
		},
		openRequired,
		openOptional,
		blocked,
		done,
		candidates,
		next: candidates[0] ?? null,
	}
}

/**
 * Computes the RuntimeState from a form and data, with error fallback.
 */
export function computeRuntimeState(
	form: Form,
	fieldValues: Record<string, unknown>,
): FormRuntimeState {
	const result = evaluateFormDefs(form, { fields: fieldValues })
	if ('value' in result) {
		return result.value
	}
	return { fields: new Map(), annexes: new Map(), defsValues: new Map() }
}

/**
 * Get available fill targets from form state.
 */
export function getAvailableFillTargets(
	form: Form,
	fieldValues: Record<string, unknown>,
	partyValues: Record<string, unknown>,
	annexValues: Record<string, unknown>,
	runtimeState: FormRuntimeState,
	options?: FillTargetOptions,
): FillTarget[] {
	const state = computeFillState(form, fieldValues, partyValues, annexValues, runtimeState, options)
	return state.candidates
}

/**
 * Get next fill target from form state.
 */
export function getNextFillTarget(
	form: Form,
	fieldValues: Record<string, unknown>,
	partyValues: Record<string, unknown>,
	annexValues: Record<string, unknown>,
	runtimeState: FormRuntimeState,
	options?: FillTargetOptions,
): FillTarget | null {
	const state = computeFillState(form, fieldValues, partyValues, annexValues, runtimeState, options)
	return state.next
}
