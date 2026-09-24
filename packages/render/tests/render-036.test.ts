/**
 * render-036: a direct render reads every flattened FormData root as a root,
 * never as a field value.
 */
import { describe, expect, test } from 'vitest'
import type { FormData } from '@paradoc/types'
import { flattenRenderData } from '../src/render-data'
import { templateRoots } from '../src/template/context'

describe('render-036', () => {
	const data = {
		fields: { name: 'Ada', witnesses: 2 },
		parties: { buyer: { id: 'p1', name: 'Ada' } },
		signatories: { buyer: [] },
		annexes: {},
		defs: {},
		signers: {},
		captures: {},
	} as unknown as FormData

	test('flattened FormData roots are not field values', () => {
		const roots = templateRoots(flattenRenderData(data))
		expect(roots.fields).toEqual({ name: 'Ada', witnesses: 2 })
		expect(roots.parties).toEqual(data.parties)
	})

	test('a field named like a former reserved root stays a field', () => {
		const roots = templateRoots({ witnesses: 2, signatures: 'x', signatories: {} })
		expect(roots.fields).toEqual({ witnesses: 2, signatures: 'x' })
	})
})
