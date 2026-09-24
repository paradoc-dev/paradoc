import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { Bundle, Formatter, ParadocRenderer, RendererLayer, RenderRequest, SignatureSlot } from '@paradoc/types'
import { createLayerRenderer } from '@paradoc/render'
import { bundle, checklist, document, form } from '@/artifacts'
import { assembleBundle, BundleSealError, sealBundle, UnregisteredLayerRendererError } from '@/rendering'

/**
 * Every bundle part renders through one part renderer, so `RuntimeBundle.render`,
 * `assembleBundle` and `sealBundle` give the same part for the same entry.
 */

const decode = (content: unknown): string => new TextDecoder().decode(content as Uint8Array)

const fixture = (name: string): Uint8Array =>
	new Uint8Array(readFileSync(join(__dirname, '..', 'artifacts', 'form', 'fixtures', name)))
const encodedPdf = fixture('auto-encoded.pdf')
const cleanPdf = fixture('auto-clean.pdf')
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const stub: ParadocRenderer<RendererLayer, string> = { id: 'stub', render: () => 'STUB OUTPUT' }

const reactRenderer = (): ParadocRenderer<RendererLayer, Uint8Array> => ({
	id: 'react-stub',
	render: (request: RenderRequest<RendererLayer>) =>
		(request.ctx?.signing?.markers ?? []).length > 0 ? encodedPdf : cleanPdf,
})

const doneChecklist = () =>
	checklist({
		name: 'cl',
		version: '1.0.0',
		title: 'CL',
		items: [{ id: 'done', title: 'Done' }],
		layers: { md: { kind: 'inline', mimeType: 'text/markdown', text: 'Done: {{items.done}}' } },
		defaultLayer: 'md',
	})

const tsxDocument = () =>
	document({
		kind: 'document',
		name: 'doc',
		version: '1.0.0',
		title: 'Doc',
		defaultLayer: 'c',
		layers: { c: { kind: 'file', mimeType: 'text/tsx', path: 'doc.tsx' } },
	})

const tsxChecklist = () =>
	checklist({
		name: 'tcl',
		version: '1.0.0',
		title: 'TCL',
		items: [{ id: 'done', title: 'Done' }],
		layers: { c: { kind: 'file', mimeType: 'text/tsx', path: 'cl.tsx' } },
		defaultLayer: 'c',
	})

const tsxForm = () =>
	form()
		.name('f')
		.version('1.0.0')
		.title('F')
		.fields({ v: { type: 'text', label: 'V' } })
		.fileLayer('c', { mimeType: 'text/tsx', path: 'f.tsx' })
		.defaultLayer('c')
		.build()

const inlineBundle = (...keys: string[]): Bundle => ({
	kind: 'bundle',
	name: 'b',
	version: '1.0.0',
	title: 'B',
	contents: keys.map((key) => ({
		type: 'inline' as const,
		key,
		artifact: { kind: 'document' as const, name: key, version: '1.0.0', title: key },
	})),
})

describe('rendering a checklist part', () => {
	test('a bundle renders a checklist template exactly as a direct render does (core-001)', async () => {
		const cl = doneChecklist()
		const filled = cl.fill({ done: true })
		const direct = await filled.render({ renderer: createLayerRenderer() })
		const b = bundle().name('b').version('1.0.0').title('B').inline('cl', cl).build()
		const out = decode((await b.prepare({ cl: filled }).render()).outputs.cl!.content)
		expect(out).toBe('Done: Yes')
		expect(out).toBe(String(direct))
	})

	test('assembleBundle and RuntimeBundle.render give the same checklist part (core-069)', async () => {
		const cl = doneChecklist()
		const b = bundle().name('b').version('1.0.0').title('B').inline('cl', cl).build()
		const viaAssemble = await assembleBundle(b.toJSON() as Bundle, { contents: { cl: cl.fill({ done: true }) } })
		const viaRuntime = await b.prepare({ cl: cl.fill({ done: true }) }).render()
		expect(decode(viaRuntime.outputs.cl!.content)).toBe(decode(viaAssemble.outputs.cl!.content))
		expect(viaRuntime.outputs.cl!.filename).toBe(viaAssemble.outputs.cl!.filename)
	})

	test('a checklist React layer renders through the registry passed to the bundle', async () => {
		const cl = tsxChecklist()
		const b = bundle().name('b').version('1.0.0').title('B').inline('tcl', cl).build()
		const rendered = await b.prepare({ tcl: cl.fill({ done: true }) }).render({ renderers: { 'text/tsx': stub } })
		expect(decode(rendered.outputs.tcl!.content)).toBe('STUB OUTPUT')
	})

	test('a checklist React layer with no registered renderer names the missing renderer', async () => {
		const cl = tsxChecklist()
		const b = bundle().name('b').version('1.0.0').title('B').inline('tcl', cl).build()
		await expect(b.prepare({ tcl: cl.fill({ done: true }) }).render()).rejects.toBeInstanceOf(
			UnregisteredLayerRendererError,
		)
	})
})

describe('rendering a document or form part (core-068)', () => {
	test('a document renders through the registry in both bundle paths', async () => {
		const renderers = { 'text/tsx': stub }
		const assembled = await assembleBundle(inlineBundle('doc'), { renderers, contents: { doc: tsxDocument().prepare() } })
		expect(decode(assembled.outputs.doc!.content)).toBe('STUB OUTPUT')

		const b = bundle().name('b').version('1.0.0').title('B').inline('doc', tsxDocument()).build()
		const rendered = await b.prepare({ doc: tsxDocument().prepare() }).render({ renderers })
		expect(decode(rendered.outputs.doc!.content)).toBe('STUB OUTPUT')
	})

	test('a document React layer with no registered renderer names the missing renderer', async () => {
		await expect(
			assembleBundle(inlineBundle('doc'), { contents: { doc: tsxDocument().prepare() } }),
		).rejects.toBeInstanceOf(UnregisteredLayerRendererError)
	})

	test('a form React layer with no registered renderer gets the error a direct render gives', async () => {
		await expect(tsxForm().fill({ fields: {} }).render()).rejects.toBeInstanceOf(UnregisteredLayerRendererError)
		await expect(
			assembleBundle(inlineBundle('f'), { contents: { f: tsxForm().fill({ fields: {} }) } }),
		).rejects.toBeInstanceOf(UnregisteredLayerRendererError)
	})
})

describe('what every member receives', () => {
	test('renderers, formatter and progressive reach a form, a checklist and a document alike', async () => {
		const seen: { kind: string; formatter?: unknown; progressive?: unknown }[] = []
		const spy: ParadocRenderer<RendererLayer, string> = {
			id: 'spy',
			render: (request) => {
				seen.push({ kind: request.kind, formatter: request.ctx?.formatter, progressive: request.ctx?.progressive })
				return request.kind
			},
		}
		const markdown = { mimeType: 'text/markdown', text: 'x' } as const
		const f = form().name('f').version('1.0.0').title('F').fields({ v: { type: 'text', label: 'V' } })
			.inlineLayer('md', markdown).defaultLayer('md').build()
		const cl = checklist().name('cl').version('1.0.0').title('CL').item({ id: 'a', title: 'A' })
			.inlineLayer('md', markdown).defaultLayer('md').build()
		const doc = document({
			kind: 'document', name: 'doc', version: '1.0.0', title: 'Doc', defaultLayer: 'md',
			layers: { md: { kind: 'inline', ...markdown } },
		})
		const b = bundle().name('b').version('1.0.0').title('B').inline('f', f).inline('cl', cl).inline('doc', doc).build()
		const formatter = { id: 'custom' } as unknown as Formatter
		const progressive = { missing: 'blank' } as never

		const rendered = await b
			.prepare({ f: f.fill({ fields: {} }), cl: cl.fill({}), doc: doc.prepare() })
			.render({ renderers: { 'text/markdown': spy }, formatter, progressive })

		expect(Object.keys(rendered.outputs).sort()).toEqual(['cl', 'doc', 'f'])
		expect(seen.map((s) => s.kind).sort()).toEqual(['checklist', 'document', 'form'])
		for (const call of seen) {
			expect(call.formatter).toBe(formatter)
			expect(call.progressive).toBe(progressive)
		}
	})

	test('a part whose target layer is missing names the layer and the content key', async () => {
		const cl = doneChecklist()
		const draft = cl.fill({ done: true })
		const broken = { ...draft, targetLayer: 'gone' } as typeof draft
		await expect(
			assembleBundle(inlineBundle('cl'), { contents: { cl: broken } }),
		).rejects.toThrow('Layer "gone" not found for content "cl"')
	})
})

describe('naming and sealing bytes parts', () => {
	const slot: SignatureSlot = { party: { role: 'client' }, type: 'signature', placement: 'flow' }
	const signedPart = () =>
		form()
			.name('first').version('1.0.0').title('first')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'client', partyType: 'person', signature: { required: true } } })
			.fileLayer('composition', { mimeType: 'text/tsx', path: 'first.tsx', signatures: { sig: slot } })
			.defaultLayer('composition')
			.build()
			.fill({ fields: { amount: 10 }, parties: { client: { id: 'client-0', name: 'client' } } })
			.addSigner('s1', { person: { name: 'client' } })
			.addSignatory('client', 'client-0', { signerId: 's1' })
	const packet = inlineBundle('first', 'annex')

	test('an Application/PDF annex is named .pdf and sealed as a PDF (core-070)', async () => {
		const annex = { kind: 'bytes' as const, content: cleanPdf, mimeType: 'Application/PDF' }
		const assembled = await assembleBundle(packet, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: { first: signedPart(), annex },
		})
		expect(assembled.outputs.annex!.filename).toBe('annex.pdf')
		expect(assembled.outputs.annex!.mimeType).toBe('application/pdf')

		const sealed = await sealBundle(packet, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: { first: signedPart(), annex },
		})
		const part = sealed.parts.find((p) => p.key === 'annex')!
		expect(part.attached).toBe(false)
		expect(part.filename).toBe('annex.pdf')
	})

	test('an annex declared as a PDF whatever its case is still refused when its bytes are not one', async () => {
		await expect(
			sealBundle(packet, {
				renderers: { 'text/tsx': reactRenderer() },
				contents: { first: signedPart(), annex: { kind: 'bytes', content: png, mimeType: 'Application/PDF' } },
			}),
		).rejects.toBeInstanceOf(BundleSealError)
	})

	test('a png annex with no filename takes the png extension in assembly and sealing (core-071)', async () => {
		const annex = { kind: 'bytes' as const, content: png, mimeType: 'image/png' }
		const assembled = await assembleBundle(packet, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: { first: signedPart(), annex },
		})
		const sealed = await sealBundle(packet, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: { first: signedPart(), annex },
		})
		const part = sealed.parts.find((p) => p.key === 'annex')!
		expect(part.mimeType).toBe('image/png')
		expect(part.filename).toBe('annex.png')
		expect(assembled.outputs.annex!.filename).toBe('annex.png')
	})

	test('a bytes annex keeps the filename it names', async () => {
		const assembled = await assembleBundle(packet, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: { first: signedPart(), annex: { kind: 'bytes', content: png, mimeType: 'image/png', filename: 'scan.png' } },
		})
		expect(assembled.outputs.annex!.filename).toBe('scan.png')
	})
})
