/**
 * core-019: a definition-level render hoisted bare values named parties,
 * annexes, defs or fields out of the field values.
 * Input: a form with a text field "parties".
 * Expected: render data is FormData only (D7). The renderer receives the
 * field values exactly as given, whatever their ids, and a payload of bare
 * field values is refused rather than reshaped.
 */
import { expect, test } from 'vitest'
import { form } from '@/artifacts'
import type { FormData, ParadocRenderer, RendererLayer } from '@paradoc/types'

const definition = () =>
	form()
		.name('f')
		.version('1.0.0')
		.title('F')
		.fields({
			parties: { type: 'text', label: 'Contracting parties' },
			fields: { type: 'text', label: 'Fields of work' },
		})
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'P: {{fields.parties}}' })
		.defaultLayer('md')
		.build()

const recordingRenderer = () => {
	const seen: FormData[] = []
	const renderer: ParadocRenderer<RendererLayer, string> = {
		id: 'recording',
		render(request) {
			if (request.kind !== 'form') throw new Error(`expected a form request, got ${request.kind}`)
			seen.push(request.data)
			return 'rendered'
		},
	}
	return { renderer, seen }
}

test('core-019 field values named "parties" and "fields" stay under fields', async () => {
	const { renderer, seen } = recordingRenderer()
	const data = { fields: { parties: 'Acme and Bob', fields: 'Plumbing' } }

	await definition().render({ renderer, data })

	expect(seen).toEqual([{ fields: { parties: 'Acme and Bob', fields: 'Plumbing' } }])
})

test('core-019 bare field values are refused', async () => {
	const { renderer, seen } = recordingRenderer()

	await expect(definition().render({ renderer, data: { parties: 'Acme and Bob' } } as never)).rejects.toThrow(
		/render `data` must be FormData/,
	)
	expect(seen).toEqual([])
})
