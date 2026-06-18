import { describe, test, expect } from 'vitest'
import type { Form, FormField } from '@paradoc/types'
import { form } from '@/artifacts'
import { buildFieldDependencyGraph, transitiveBlockers } from '@/fill-state/dependency-graph'
import { topologicalSort } from '@/logic/shared/topological-sort'

const mkForm = (fields: Record<string, FormField>): Form => ({
	kind: 'form',
	name: 'g',
	version: '1.0.0',
	title: 'G',
	fields,
})

// ────────────────────────────────────────────── shared topological sort

describe('topologicalSort (shared, forgiving)', () => {
	test('orders prerequisites before dependents', () => {
		const deps = new Map([
			['c', ['b']],
			['b', ['a']],
			['a', []],
		])
		const { sorted, cyclic } = topologicalSort(deps.keys(), (n) => deps.get(n) ?? [])
		expect(cyclic.size).toBe(0)
		expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'))
		expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'))
	})

	test('reports cycles (including a self-edge) without throwing', () => {
		const deps = new Map([
			['a', ['b']],
			['b', ['a']],
			['s', ['s']],
		])
		const { cyclic } = topologicalSort(deps.keys(), (n) => deps.get(n) ?? [])
		expect(cyclic.has('a')).toBe(true)
		expect(cyclic.has('b')).toBe(true)
		expect(cyclic.has('s')).toBe(true) // self-edge is a one-node cycle
	})
})

// ────────────────────────────────────────────── field dependency graph

describe('buildFieldDependencyGraph', () => {
	test('edges from visible references; prerequisites rank earlier', () => {
		const g = buildFieldDependencyGraph(
			mkForm({
				a: { type: 'boolean' },
				b: { type: 'text', visible: 'fields.a == true' },
			}),
		)
		expect(g.dependsOn.get('b')?.has('a')).toBe(true)
		expect(g.topoRank.get('a')!).toBeLessThan(g.topoRank.get('b')!)
	})

	test('cascade ancestor edge: a fieldset child depends on its fieldset', () => {
		const g = buildFieldDependencyGraph(
			mkForm({
				section: {
					type: 'fieldset',
					visible: 'fields.show == true',
					fields: { inner: { type: 'text' } },
				},
				show: { type: 'boolean' },
			}),
		)
		expect(g.dependsOn.get('section.inner')?.has('section')).toBe(true)
		expect(g.dependsOn.get('section')?.has('show')).toBe(true)
	})

	test('required contributes no edges (required never blocks)', () => {
		const g = buildFieldDependencyGraph(
			mkForm({
				a: { type: 'boolean' },
				b: { type: 'text', required: 'fields.a == true' },
			}),
		)
		expect(g.dependsOn.get('b')?.has('a') ?? false).toBe(false)
	})
})

// ────────────────────────────────────────────── transitive blockers

describe('transitiveBlockers', () => {
	const g = buildFieldDependencyGraph(
		mkForm({
			a: { type: 'boolean' },
			b: { type: 'text', visible: 'fields.a == true' },
			c: { type: 'text', visible: 'fields.b != null' },
		}),
	)

	test('collects transitive unfilled prerequisites (not just 1-hop)', () => {
		expect(transitiveBlockers(g, 'c', new Set(['a', 'b', 'c'])).sort()).toEqual(['a', 'b'])
	})

	test('filled prerequisites are not blockers', () => {
		expect(transitiveBlockers(g, 'c', new Set(['c']))).toEqual([])
	})

	test('forgiving cycle: a cyclic node never deadlocks (no blockers, no throw)', () => {
		const gc = buildFieldDependencyGraph(
			mkForm({
				x: { type: 'text', visible: 'fields.y != null' },
				y: { type: 'text', visible: 'fields.x != null' },
			}),
		)
		expect(gc.cyclic.has('x')).toBe(true)
		expect(transitiveBlockers(gc, 'x', new Set(['x', 'y']))).toEqual([])
	})
})

// ────────────────────────────────────────────── status ordinal (integration)

describe('fill state — status ordinal', () => {
	test('each item carries hidden | optional | required', () => {
		const f = form()
			.name('i')
			.version('1.0.0')
			.title('I')
			.fields({
				a: { type: 'boolean', label: 'A', required: true },
				b: { type: 'text', label: 'B', visible: 'fields.a == true', required: true },
				note: { type: 'text', label: 'Note' },
			})
			.build()

		const state = (f as unknown as { partialFill: () => { getFillState: () => any } }).partialFill().getFillState()
		const byKey = new Map<string, { status: string }>()
		for (const bucket of [state.openRequired, state.openOptional, state.blocked, state.done]) {
			for (const item of bucket) byKey.set(item.key, item)
		}
		expect(byKey.get('a')?.status).toBe('required') // visible + required
		expect(byKey.get('note')?.status).toBe('optional') // visible, not required
		expect(byKey.get('b')?.status).toBe('hidden') // a unfilled -> b not visible
	})
})
