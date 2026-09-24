import { describe, expect, test } from 'vitest'
import { checklist, document, form } from '@/artifacts'
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
			if (request.kind !== 'form') throw new Error(`expected a form request, got ${request.kind}`)
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
	test('passes a FormData payload through as it is', async () => {
		const { renderer, seen } = recordingRenderer()
		const parties = { applicant: { id: 'applicant-0', name: 'Ada Applicant' } }
		const data = { fields: { amount: 250 }, parties, annexes: { photo } }

		await application.render({ renderer, data })

		expect(seen).toEqual([data])
	})

	test('hands over no values when no data is given', async () => {
		const { renderer, seen } = recordingRenderer()

		await application.render({ renderer })

		expect(seen).toEqual([{ fields: {} }])
	})

	test('refuses bare field values rather than guessing which keys are fields', async () => {
		const { renderer, seen } = recordingRenderer()

		await expect(
			application.render({ renderer, data: { amount: 250, parties: {} } as never }),
		).rejects.toThrow(/render `data` must be FormData/)
		expect(seen).toEqual([])
	})
})

/** A renderer that records every request it is handed, whole. */
function requestRecorder() {
	const seen: RenderRequest<RendererLayer>[] = []
	const renderer: ParadocRenderer<RendererLayer, string> = {
		id: 'request-recorder',
		render(request: RenderRequest<RendererLayer>) {
			seen.push(request)
			return 'rendered'
		},
	}
	return { renderer, seen }
}

describe('the artifact a render request names', () => {
	test('a form request names the form and carries its FormData', async () => {
		const { renderer, seen } = requestRecorder()

		await application.fill({ fields: { amount: 250 } } as never).render({ renderer })

		const [request] = seen
		expect(request?.kind).toBe('form')
		if (request?.kind !== 'form') return
		expect(request.artifact.kind).toBe('form')
		expect(request.artifact.name).toBe('application')
		expect(request.data.fields).toEqual({ amount: 250 })
	})

	test('a document request names the document and carries no payload', async () => {
		const { renderer, seen } = requestRecorder()
		const notice = document({
			name: 'notice',
			version: '1.0.0',
			title: 'Notice',
			layers: { main: { kind: 'inline', mimeType: 'text/plain', text: 'Hello' } },
			defaultLayer: 'main',
		})

		await notice.render({ renderers: { 'text/plain': renderer } })

		const [request] = seen
		expect(request?.kind).toBe('document')
		expect(request?.artifact).toMatchObject({ kind: 'document', name: 'notice' })
		expect(request).not.toHaveProperty('data')
	})

	test('a checklist request names the checklist and carries its item statuses', async () => {
		const { renderer, seen } = requestRecorder()
		const onboarding = checklist({
			name: 'onboarding',
			version: '1.0.0',
			title: 'Onboarding',
			items: [
				{ id: 'badge', title: 'Badge issued' },
				{ id: 'laptop', title: 'Laptop issued' },
			] as const,
			layers: { main: { kind: 'inline', mimeType: 'text/plain', text: 'Checklist' } },
			defaultLayer: 'main',
		})

		await onboarding.fill({ badge: true }).render({ renderer })
		await onboarding.render({ renderer })

		const [filled, definition] = seen
		expect(filled?.kind).toBe('checklist')
		expect(filled?.artifact).toMatchObject({ kind: 'checklist', name: 'onboarding' })
		expect(filled?.kind === 'checklist' && filled.data).toEqual({ items: { badge: true, laptop: null } })
		expect(definition?.kind === 'checklist' && definition.data).toEqual({ items: { badge: null, laptop: null } })
	})
})
