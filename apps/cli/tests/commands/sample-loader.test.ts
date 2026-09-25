import { describe, expect, it } from 'vitest'
import { loadSampleData } from '../../src/commands/dev/sample-loader.js'
import type { SampleSource } from '../../src/commands/dev/discovery.js'

const sibling: SampleSource = {
	file: '/project/po.sample.ts',
	relative: 'po.sample.ts',
	exportName: 'default',
	from: 'sibling',
}
const composition: SampleSource = {
	file: '/project/po.tsx',
	relative: 'po.tsx',
	exportName: 'sample',
	from: 'composition',
}

describe('shared sample loader', () => {
	it('uses discovery order and exportName, calls functions, and keeps annexes', async () => {
		const result = await loadSampleData([sibling, composition], async (source) =>
			source === sibling
				? { default: () => ({ fields: { name: 'Ada' }, annexes: { cover: { name: 'cover.pdf' } } }) }
				: { sample: { fields: { name: 'wrong' } } },
		)
		expect(result).toEqual({
			fields: { name: 'Ada' },
			parties: {},
			annexes: { cover: { name: 'cover.pdf' } },
		})
	})

	it('falls through when a source does not export the name discovery selected', async () => {
		const result = await loadSampleData([sibling, composition], async (source) =>
			source === sibling ? { sample: { fields: { name: 'ignored' } } } : { sample: { fields: { name: 'used' } } },
		)
		expect(result?.fields).toEqual({ name: 'used' })
	})

	it('names a broken sibling and its cause', async () => {
		await expect(loadSampleData([sibling], async () => { throw new Error('syntax error') }))
			.rejects.toThrow('Could not load sample po.sample.ts: syntax error')
	})
})
