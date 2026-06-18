/**
 * Generic forgiving Kahn topological sort, shared by the defs dependency sort
 * (design-time) and the field dependency DAG (fill-state).
 *
 * `dependsOn(node)` lists the nodes that must come BEFORE `node` (its
 * prerequisites). The result is in dependency order (prerequisites first).
 * Nodes involved in a cycle never throw: they are reported in `cyclic` and
 * appended at the end of `sorted`.
 */

export interface TopologicalSortResult {
	/** All nodes in dependency order; cyclic nodes appended at the end. */
	readonly sorted: string[]
	/** Nodes that could not be ordered because they are in a cycle. */
	readonly cyclic: Set<string>
}

export function topologicalSort(
	nodes: Iterable<string>,
	dependsOn: (node: string) => Iterable<string>,
): TopologicalSortResult {
	const all = [...nodes]
	const nodeSet = new Set(all)
	const inDegree = new Map<string, number>()
	const dependents = new Map<string, string[]>()

	for (const n of all) {
		inDegree.set(n, 0)
		dependents.set(n, [])
	}

	for (const n of all) {
		const seenDeps = new Set<string>()
		for (const dep of dependsOn(n)) {
			// Ignore references to nodes outside the graph. A self-edge (A -> A) is
			// a one-node cycle: counting it leaves A with non-zero in-degree, so it
			// is reported as cyclic rather than ordered.
			if (!nodeSet.has(dep) || seenDeps.has(dep)) continue
			seenDeps.add(dep)
			inDegree.set(n, (inDegree.get(n) ?? 0) + 1)
			dependents.get(dep)!.push(n)
		}
	}

	const queue: string[] = all.filter((n) => (inDegree.get(n) ?? 0) === 0)
	const sorted: string[] = []
	const seen = new Set<string>()

	while (queue.length > 0) {
		const n = queue.shift()!
		if (seen.has(n)) continue
		seen.add(n)
		sorted.push(n)
		for (const m of dependents.get(n) ?? []) {
			inDegree.set(m, (inDegree.get(m) ?? 0) - 1)
			if ((inDegree.get(m) ?? 0) === 0) queue.push(m)
		}
	}

	const cyclic = new Set<string>()
	for (const n of all) {
		if (!seen.has(n)) {
			cyclic.add(n)
			sorted.push(n)
		}
	}

	return { sorted, cyclic }
}
