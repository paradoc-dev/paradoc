/**
 * Fill-state engine — runtime state computation from a form and its current
 * data. Static dependency extraction lives in `./dependency-graph`.
 */

import type { Form, FormField, FieldsetField, Party, WitnessParty } from '@paradoc/types'
import type {
	FillTarget,
	FillTargetOptions,
	FillItemState,
	FillItemStatus,
	FillState,
} from './types'
import type { EvaluationIssue, FormRuntimeState } from '@/logic/runtime/evaluation/types'
import type { RuntimeContext } from '@/artifacts/shared/runtime-context'
import { buildFormBaseContext } from '@/logic/runtime/evaluation/context-builder'
import { evaluateFormRules } from '@/logic/runtime/evaluation/rule-evaluator'
import { evaluatePartyRequiredness } from '@/validation/party'
import { buildFieldDependencyGraph, referencedIds, transitiveBlockers } from './dependency-graph'
import { fillNodeOf } from '@/logic/shared/list-paths'

/** A list row enclosing fields: its runtime id and item definition. */
interface RowScope {
	readonly id: string
	readonly field: FormField
}

/** The rows a field inside a list sees: `item`, and `parent` in a nested list. */
interface RowScopes {
	readonly item: RowScope
	readonly parent?: RowScope
}

/**
 * The runtime id an expression reference inside a row points at. `item.x` and
 * `parent.x` resolve against the bound rows; any other reference is a form-level
 * graph node. A path into a list's rows resolves to that list, as in the graph.
 */
function resolveRowReference(form: Form, ref: string, rows: RowScopes): string {
	const [root, ...rest] = ref.split('.')
	const row = root === 'item' ? rows.item : root === 'parent' ? rows.parent : undefined
	if (!row) return fillNodeOf(form.fields, ref)
	if (rest.length === 0 || row.field.type !== 'fieldset') return row.id
	return `${row.id}.${fillNodeOf(row.field.fields, rest.join('.'))}`
}

/** A field/annex's effective status from its visibility and required flags. */
function statusOf(visible: boolean, required: boolean): FillItemStatus {
	return !visible ? 'hidden' : required ? 'required' : 'optional'
}

// ============================================================================
// State Computation (runtime, from form + current data)
// ============================================================================

/** Check if a value counts as "filled" */
function isFilled(value: unknown): boolean {
	return value !== null && value !== undefined
}

function isFieldFilled(field: FormField, value: unknown): boolean {
	if (field.type !== 'list') return isFilled(value)
	return Array.isArray(value) && value.length >= (field.minItems ?? 0)
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
	const walkRepeated = (field: FormField, value: unknown, fullId: string): void => {
		if (!isFieldFilled(field, value)) unfilled.add(fullId)
		if (field.type === 'fieldset') {
			const nested = value !== null && typeof value === 'object' && !Array.isArray(value)
				? value as Record<string, unknown> : undefined
			walkFieldIds(field.fields, nested, fullId)
		} else if (field.type === 'list' && Array.isArray(value)) {
			value.forEach((item, index) => walkRepeated(field.item, item, `${fullId}[${index}]`))
		}
	}

	// Fields
	function walkFieldIds(fields: Record<string, FormField> | undefined, data: Record<string, unknown> | undefined, prefix: string = '') {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = prefix ? `${prefix}.${fieldId}` : fieldId
			const value = data?.[fieldId]
			if (!isFieldFilled(field, value)) {
				unfilled.add(fullId)
			}
			if (field.type === 'fieldset') {
				const nested = typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
				walkFieldIds((field as FieldsetField).fields, nested, fullId)
			} else if (field.type === 'list' && Array.isArray(value)) {
				value.forEach((item, index) => walkRepeated(field.item, item, `${fullId}[${index}]`))
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

/** A detached copy of an evaluation issue, so fill state never aliases runtime state. */
function cloneIssue(issue: EvaluationIssue): EvaluationIssue {
	return { ...issue, path: [...issue.path] }
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
	witnessValues: readonly WitnessParty[] = [],
	contextValue?: RuntimeContext,
): FillState {
	if (!runtimeState.resolved) {
		const defsValues: Record<string, unknown> = {}
		for (const [key, value] of runtimeState.defsValues) defsValues[key] = value
		return {
			phase: 'draft',
			summary: {
				requiredTotal: 0,
				requiredDone: 0,
				requiredRemaining: 0,
				completionPercent: 0,
			},
			defsValues,
			rules: { valid: false, errors: [], warnings: [] },
			issues: runtimeState.issues.map(cloneIssue),
			openRequired: [],
			openOptional: [],
			blocked: [],
			done: [],
			candidates: [],
			next: null,
		}
	}
	const requiredFirst = options?.requiredFirst !== false
	const includeOptional = options?.includeOptional === true
	const context = buildFormBaseContext(form, {
		fields: fieldValues,
		parties: partyValues as Record<string, Party | Party[]>,
		witnesses: witnessValues,
		context: contextValue,
	})
	for (const [key, value] of runtimeState.defsValues) {
		;(context as Record<string, unknown>)[key] = value
	}

	const graph = buildFieldDependencyGraph(form)
	const unfilledIds = getUnfilledIds(form, fieldValues, partyValues, annexValues)

	const openRequired: FillItemState[] = []
	const openOptional: FillItemState[] = []
	const blocked: FillItemState[] = []
	const done: FillItemState[] = []

	/**
	 * List rows are not graph nodes, so a field inside a row records its direct
	 * dependencies by runtime id: its `visible` references (resolved against the
	 * bound rows) and its container. Its blockers are resolved once every row is
	 * walked, so a reference to a later sibling sees that sibling's dependencies.
	 */
	const rowDeps = new Map<string, string[]>()
	const rowItems: FillItemState[] = []
	const rowBlockers = (id: string): string[] => {
		const blockers = new Set<string>()
		const visited = new Set<string>()
		const stack = [...(rowDeps.get(id) ?? [])]
		while (stack.length > 0) {
			const dep = stack.pop()!
			if (dep === id || visited.has(dep)) continue
			visited.add(dep)
			const nested = rowDeps.get(dep)
			if (nested) {
				if (unfilledIds.has(dep)) blockers.add(dep)
				stack.push(...nested)
				continue
			}
			if (graph.fillable.has(dep) && unfilledIds.has(dep)) blockers.add(dep)
			for (const blocker of transitiveBlockers(graph, dep, unfilledIds)) blockers.add(blocker)
		}
		return [...blockers]
	}

	let order = 0
	const addRowItem = (
		field: FormField,
		fullId: string,
		filled: boolean,
		containerId: string,
		rows: RowScopes,
	): void => {
		rowDeps.set(fullId, [
			...referencedIds(field.visible).map((ref) => resolveRowReference(form, ref, rows)),
			containerId,
		])
		const fieldState = runtimeState.fields.get(fullId)
		const visible = fieldState?.visible ?? true
		const isRequired = fieldState?.required ?? false
		const item: FillItemState = {
			kind: 'field', key: fullId, required: isRequired, order: order++, visible,
			status: statusOf(visible, isRequired), filled, blockedBy: [],
		}
		rowItems.push(item)
		if (filled) done.push(item)
		else if (visible && isRequired) openRequired.push(item)
		else if (visible) openOptional.push(item)
		else blocked.push(item)
	}

	/** Walks the fields under `fullId`: a fieldset's children, or a list's rows. */
	const walkChildren = (field: FormField, value: unknown, fullId: string, rows?: RowScopes): void => {
		if (field.type === 'fieldset') {
			const nested = value !== null && typeof value === 'object' && !Array.isArray(value)
				? value as Record<string, unknown> : undefined
			walkFieldsForState(field.fields, nested, fullId, rows)
		} else if (field.type === 'list' && Array.isArray(value)) {
			value.forEach((itemValue, index) => {
				const rowId = `${fullId}[${index}]`
				const row: RowScopes = { item: { id: rowId, field: field.item }, ...(rows && { parent: rows.item }) }
				addRowItem(field.item, rowId, isFieldFilled(field.item, itemValue), fullId, row)
				walkChildren(field.item, itemValue, rowId, row)
			})
		}
	}

	// --- Parties first ---
	if (form.parties) {
		for (const [roleId, partyDef] of Object.entries(form.parties)) {
			const filled = isPartyFilled(partyValues, roleId)
			const required = evaluatePartyRequiredness(partyDef, context)
			const item: FillItemState = {
				kind: 'party',
				key: roleId,
				required,
				order: order++,
				visible: true, // parties are always visible
				status: statusOf(true, required),
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
		rows?: RowScopes,
	) {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = prefix ? `${prefix}.${fieldId}` : fieldId
			const value = data?.[fieldId]
			const filled = isFieldFilled(field, value)

			if (rows) {
				addRowItem(field, fullId, filled, prefix, rows)
				walkChildren(field, value, fullId, rows)
				continue
			}

			const fieldState = runtimeState.fields.get(fullId)
			const visible = fieldState?.visible ?? true
			const isRequired = fieldState?.required ?? false

			// Transitive unfilled prerequisites that gate this field's visibility.
			const blockedBy = transitiveBlockers(graph, fullId, unfilledIds)

			const item: FillItemState = {
				kind: 'field',
				key: fullId,
				required: isRequired,
				order: order++,
				visible,
				status: statusOf(visible, isRequired),
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

			walkChildren(field, value, fullId)
		}
	}
	walkFieldsForState(form.fields, fieldValues)
	for (const item of rowItems) item.blockedBy = rowBlockers(item.key)

	// --- Annexes ---
	if (form.annexes) {
		for (const annexId of Object.keys(form.annexes)) {
			const filled = isAnnexFilled(annexValues, annexId)
			const annexState = runtimeState.annexes.get(annexId)
			const visible = annexState?.visible ?? true
			const isRequired = annexState?.required ?? false

			const blockedBy = transitiveBlockers(graph, annexId, unfilledIds)

			const item: FillItemState = {
				kind: 'annex',
				key: annexId,
				required: isRequired,
				order: order++,
				visible,
				status: statusOf(visible, isRequired),
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
	// A computed value that failed is a logic issue, reported in `issues`, not a rule result.
	const ruleResult = evaluateFormRules(form, fieldValues, runtimeState.defsValues, context)

	// --- Defs values ---
	const defsValues: Record<string, unknown> = {}
	for (const [k, v] of runtimeState.defsValues) {
		defsValues[k] = v
	}

	// --- Candidates (DAG order: prerequisites first, declaration order within a rank) ---
	const byDag = (a: FillItemState, b: FillItemState): number => {
		const ra = graph.topoRank.get(a.key) ?? Number.MAX_SAFE_INTEGER
		const rb = graph.topoRank.get(b.key) ?? Number.MAX_SAFE_INTEGER
		return ra !== rb ? ra - rb : a.order - b.order
	}
	const toTarget = (item: FillItemState): FillTarget => ({
		kind: item.kind,
		key: item.key,
		required: item.required,
		order: item.order,
	})
	const candidates: FillTarget[] = []

	if (requiredFirst) {
		for (const item of [...openRequired].sort(byDag)) candidates.push(toTarget(item))
		if (includeOptional) {
			for (const item of [...openOptional].sort(byDag)) candidates.push(toTarget(item))
		}
	} else {
		const combined = includeOptional ? [...openRequired, ...openOptional] : [...openRequired]
		for (const item of combined.sort(byDag)) candidates.push(toTarget(item))
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
			errors: ruleResult.errors,
			warnings: ruleResult.warnings,
		},
		issues: runtimeState.issues.map(cloneIssue),
		openRequired,
		openOptional,
		blocked,
		done,
		candidates,
		next: candidates[0] ?? null,
	}
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
	witnessValues: readonly WitnessParty[] = [],
	context?: RuntimeContext,
): FillTarget[] {
	const state = computeFillState(form, fieldValues, partyValues, annexValues, runtimeState, options, witnessValues, context)
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
	witnessValues: readonly WitnessParty[] = [],
	context?: RuntimeContext,
): FillTarget | null {
	const state = computeFillState(form, fieldValues, partyValues, annexValues, runtimeState, options, witnessValues, context)
	return state.next
}
