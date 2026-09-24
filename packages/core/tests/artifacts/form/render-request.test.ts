import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import type { FormData, ParadocRenderer, RendererLayer, RenderRequest } from '@paradoc/types'

/**
 * The payload core hands a renderer is the runtime `FormData`: field values in
 * `fields`, and everything else a filled form carries beside them. A renderer
 * that reads `data.annexes` (a React composition does) must find the annexes
 * there, and a renderer that reads `data.fields` must find only field values.
 */

const photo = { name: 'photo.png', mimeType: 'image/png' }

const application = form({
	kind: 'form',
	name: 'application',
	version: '1.0.0',
	title: 'Application',
	fields: {
		amount: { type: 'number', label: 'Amount' },
		note: { type: 'text', label: 'Note' },
	},
	defs: { large: { type: 'boolean', value: 'fields.amount > 100' } },
	parties: { applicant: { label: 'Applicant', partyType: 'person', signature: { required: true } } },
	annexes: { photo: { title: 'Photo' } },
	defaultLayer: 'main',
	layers: { main: { kind: 'inline', mimeType: 'text/plain', text: 'Amount: {{fields.amount}}' } },
} as never)

/** A renderer that records the data of every request it is handed. */
function recordingRenderer() {
	const seen: FormData[] = []
	const renderer: ParadocRenderer<RendererLayer, string> = {
		id: 'recording',
		render(request: RenderRequest<RendererLayer>) {
			seen.push(request.data)
			return 'rendered'
		},
	}
	return { renderer, seen }
}

describe('the render request a filled form hands its renderer', () => {
	test('carries annexes, signers and computed values beside fields, and fields holds only field values', async () => {
		const { renderer, seen } = recordingRenderer()
		const draft = application
			.fill({
				fields: { amount: 250, note: 'Hello' },
				parties: { applicant: { id: 'applicant-0', name: 'Ada Applicant' } },
				annexes: { photo },
			} as never)
			.addSigner('ada', { person: { name: 'Ada Applicant' } })

		await draft.render({ renderer })

		const [data] = seen
		expect(Object.keys(data!.fields).sort()).toEqual(['amount', 'note'])
		expect(data!.fields).toEqual({ amount: 250, note: 'Hello' })
		expect(data!.annexes).toEqual({ photo })
		expect(data!.signers).toEqual({ ada: { person: { name: 'Ada Applicant' } } })
		expect(data!.defs).toEqual({ large: true })
		expect(data!.parties?.applicant).toMatchObject({ id: 'applicant-0', name: 'Ada Applicant' })
	})

	test('leaves out what the form does not carry, and never adds it to fields', async () => {
		const { renderer, seen } = recordingRenderer()

		await application.fill({ fields: { amount: 5 } } as never).render({ renderer })

		const [data] = seen
		expect(data!.fields).toEqual({ amount: 5 })
		expect(data).not.toHaveProperty('annexes')
		expect(data).not.toHaveProperty('signers')
		expect(data).not.toHaveProperty('captures')
		expect(data!.defs).toEqual({ large: false })
	})
})

describe('the render request a definition-level render hands its renderer', () => {
	test('moves parties and annexes given with bare values beside fields', async () => {
		const { renderer, seen } = recordingRenderer()
		const parties = { applicant: { name: 'Ada Applicant' } }

		await application.render({ renderer, data: { amount: 250, parties, annexes: { photo } } })

		expect(seen).toEqual([{ fields: { amount: 250 }, parties, annexes: { photo } }])
	})

	test('passes a FormData payload through as it is', async () => {
		const { renderer, seen } = recordingRenderer()
		const data = { fields: { amount: 250 }, annexes: { photo } }

		await application.render({ renderer, data })

		expect(seen).toEqual([data])
	})
})
