/**
 * Field dependency graph for the fill-state engine.
 *
 * Nodes are fields, defs, parties, and annexes. Edges come from `visible`
 * expressions (a node depends on the fields/defs its visibility references)
 * plus cascade ancestor edges (a field depends on its enclosing fieldset, so a
 * hidden container's prerequisites flow down). Defs are included as non-fillable
 * nodes so transitivity flows `field -> def -> the def's fields`.
 *
 * `required` contributes NO edges — it never blocks. The graph is topologically
 * sorted (forgiving: cycles never throw; cyclic nodes are reported and treated
 * as eligible rather than deadlocked).
 */

import type { Form, FormField, FieldsetField, Expression } from '@paradoc/types'
import { parseExpression } from '@/logic/design-time/validation/expression-parser'
import { topologicalSort } from '@/logic/shared/topological-sort'

/** Party/witness functions are not field dependencies. */
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

/** Field/def ids referenced by an expression (`fields.` stripped, functions dropped). */
export function referencedIds(expr: boolean | string | undefined): string[] {
	if (typeof expr !== 'string') return []
	const result = parseExpression(expr)
	if (!result.success) return []
	const ids: string[] = []
	for (const v of result.variables) {
		if (KNOWN_FUNCTIONS.has(v)) continue
		ids.push(v.startsWith('fields.') ? v.slice(7) : v)
	}
	return ids
}

function defExpressionRefs(expr: Expression): string[] {
	const value = (expr as { value: unknown }).value
	if (typeof value === 'string') return referencedIds(value)
	if (value && typeof value === 'object') {
		const ids: string[] = []
		for (const v of Object.values(value as Record<string, unknown>)) {
			if (typeof v === 'string') ids.push(...referencedIds(v))
		}
		return ids
	}
	return []
}

export interface FieldDependencyGraph {
	/** node id -> the ids it depends on (visible refs + cascade ancestor). */
	readonly dependsOn: Map<string, Set<string>>
	/** ids that are fillable items (fields, parties, annexes); defs are not. */
	readonly fillable: Set<string>
	/** topological rank (prerequisites first); used for DAG-ordered next-field. */
	readonly topoRank: Map<string, number>
	/** nodes in a dependency cycle (treated as eligible, never deadlocked). */
	readonly cyclic: Set<string>
}

export function buildFieldDependencyGraph(form: Form): FieldDependencyGraph {
	const dependsOn = new Map<string, Set<string>>()
	const fillable = new Set<string>()

	const ensure = (id: string): Set<string> => {
		let set = dependsOn.get(id)
		if (!set) {
			set = new Set<string>()
			dependsOn.set(id, set)
		}
		return set
	}

	// Parties first (leaf, always visible) — keeps parties early in DAG order.
	if (form.parties) {
		for (const roleId of Object.keys(form.parties)) {
			ensure(roleId)
			fillable.add(roleId)
		}
	}

	// Fields, with fieldset nesting and the cascade ancestor edge.
	const walk = (fields: Record<string, FormField> | undefined, parentId: string | null): void => {
		if (!fields) return
		for (const [fieldId, field] of Object.entries(fields)) {
			const fullId = parentId ? `${parentId}.${fieldId}` : fieldId
			const deps = ensure(fullId)
			for (const d of referencedIds(field.visible)) deps.add(d)
			if (parentId) deps.add(parentId)
			fillable.add(fullId)
			if (field.type === 'fieldset') walk((field as FieldsetField).fields, fullId)
		}
	}
	walk(form.fields, null)

	// Defs as non-fillable nodes so transitivity flows through them.
	if (form.defs) {
		for (const [key, expr] of Object.entries(form.defs)) {
			const deps = ensure(key)
			for (const d of defExpressionRefs(expr)) deps.add(d)
		}
	}

	// Annexes (fillable, visibility deps).
	if (form.annexes) {
		for (const [annexId, annex] of Object.entries(form.annexes)) {
			const deps = ensure(annexId)
			for (const d of referencedIds(annex.visible)) deps.add(d)
			fillable.add(annexId)
		}
	}

	const { sorted, cyclic } = topologicalSort(dependsOn.keys(), (n) => dependsOn.get(n) ?? [])
	const topoRank = new Map<string, number>()
	sorted.forEach((n, i) => topoRank.set(n, i))

	return { dependsOn, fillable, topoRank, cyclic }
}

/**
 * Transitive, fillable, unfilled prerequisites of `node`. Walks the dependency
 * closure (through non-fillable defs) and collects fillable nodes that are still
 * unfilled. A node in a cycle is treated as eligible (no blockers) so cycles
 * never deadlock.
 */
export function transitiveBlockers(
	graph: FieldDependencyGraph,
	node: string,
	unfilledFillable: Set<string>,
): string[] {
	if (graph.cyclic.has(node)) return []
	const blockers = new Set<string>()
	const visited = new Set<string>()
	const stack = [...(graph.dependsOn.get(node) ?? [])]
	while (stack.length > 0) {
		const dep = stack.pop()!
		if (dep === node || visited.has(dep)) continue
		visited.add(dep)
		if (graph.fillable.has(dep) && unfilledFillable.has(dep)) blockers.add(dep)
		for (const d of graph.dependsOn.get(dep) ?? []) stack.push(d)
	}
	return [...blockers]
}
