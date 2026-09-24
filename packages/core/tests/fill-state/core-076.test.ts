/**
 * core-076: a visibility reference into a composite field added no dependency edge.
 * Input: addr (address, required); caId visible when `fields.addr.region == 'CA'`;
 *   control: other visible when `fields.flag == true`.
 * Expected: caId depends on `addr` (graph edge, blockedBy ['addr'], ranked after addr).
 */
import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import { buildFieldDependencyGraph } from '@/fill-state/dependency-graph'

const f = form()
	.name('c')
	.version('1.0.0')
	.title('C')
	.fields({
		addr: { type: 'address', label: 'Address', required: true },
		caId: { type: 'text', label: 'CA id', required: true, visible: "fields.addr.region == 'CA'" },
		flag: { type: 'boolean', label: 'Flag', required: true },
		other: { type: 'text', label: 'Other', required: true, visible: 'fields.flag == true' },
	} as never)
	.build()

describe('core-076', () => {
	test('graph: caId depends on the addr node', () => {
		const g = buildFieldDependencyGraph(f as never)
		expect([...g.dependsOn.get('other')!]).toEqual(['flag']) // control
		expect([...g.dependsOn.get('caId')!]).toEqual(['addr'])
		expect(g.topoRank.get('caId')!).toBeGreaterThan(g.topoRank.get('addr')!)
	})

	test('fill state: caId is blocked by addr', () => {
		const state = (f as unknown as { fill: () => { getFillState: () => any } }).fill().getFillState()
		const blocked = new Map<string, { blockedBy?: string[] }>(state.blocked.map((i: any) => [i.key, i]))
		expect(blocked.get('other')?.blockedBy).toEqual(['flag']) // control
		expect(blocked.get('caId')?.blockedBy).toEqual(['addr'])
	})
})
