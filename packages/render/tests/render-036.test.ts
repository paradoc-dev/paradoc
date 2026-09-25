/**
 * render-036: a direct render preserves `fields` as its own root beside every
 * reserved FormData root.
 */
import { describe, expect, test } from 'vitest'
import type { FormData } from '@paradoc/types'
import { flattenRenderData } from '../src/render-data'
import { templateRoots } from '../src/template/context'
import { renderText } from '../src/text/render'

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

	test('FormData roots are not field values', () => {
		const roots = templateRoots(flattenRenderData(data))
		expect(roots.fields).toEqual({ name: 'Ada', witnesses: 2 })
		expect(roots.parties).toEqual(data.parties)
	})

	test('field ids that match reserved roots remain addressable through fields', () => {
		const colliding = {
			fields: { parties: 'field parties', annexes: 'field annexes', defs: 'field defs', signatories: 'field signatories' },
			parties: { buyer: { id: 'p1', name: 'Ada' } },
			annexes: { proof: { name: 'proof.pdf' } },
			defs: { total: 42 },
			signatories: { buyer: [] },
		} as unknown as FormData
		const flattened = flattenRenderData(colliding)
		const roots = templateRoots(flattened)

		expect(roots.fields).toEqual(colliding.fields)
		expect(roots.parties).toEqual(colliding.parties)
		expect(flattened.annexes).toEqual(colliding.annexes)
		expect(flattened.defs).toEqual(colliding.defs)
		expect(flattened.signatories).toEqual(colliding.signatories)
	})

	test('renders colliding field ids beside formatted reserved roots', () => {
		const form = {
			fields: {
				parties: { type: 'text' }, annexes: { type: 'text' }, defs: { type: 'text' }, signatories: { type: 'text' },
			},
			parties: { buyer: { label: 'Buyer', partyType: 'person' } },
			defs: { total: { type: 'number', value: {} } },
		} as never
		const rendered = renderText({
			form,
			template: '{{fields.parties}}|{{fields.annexes}}|{{fields.defs}}|{{fields.signatories}}|{{parties.buyer}}|{{total}}',
			data: {
				fields: { parties: 'P', annexes: 'A', defs: 'D', signatories: 'S' },
				parties: { buyer: { id: 'p1', name: 'Ada' } },
				defs: { total: 42 },
			},
		})

		expect(rendered).toBe('P|A|D|S|Ada|42')
	})

	test('a field named like a former reserved root stays a field', () => {
		const roots = templateRoots({ witnesses: 2, signatures: 'x', signatories: {} })
		expect(roots.fields).toEqual({ witnesses: 2, signatures: 'x' })
	})
})
