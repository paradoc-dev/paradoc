import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { pageTextRuns } from '@paradoc/render/pdf'
import type { Bundle, ParadocRenderer, RendererLayer, RenderRequest, SignatureSlot } from '@paradoc/types'
import { form, SealConfigError, UnboundResolverError } from '@/artifacts'
import { assembleBundle, BundleSealError, sealBundle } from '@/rendering'

/**
 * Sealing a bundle as one packet.
 *
 * A packet is several documents a signer signs as one thing, so what this file
 * pins is what makes them one: the parts land on contiguous packet pages, every
 * slot resolves onto the packet page its part occupies, one signer holds one
 * index across the whole packet, and the hashes describe the packet rather than
 * any part of it.
 *
 * The renderer stands in for `@paradoc/react/pdf`, exactly as it does in
 * `tests/artifacts/form/react-layer-seal.test.ts`, so nothing here needs React
 * and the fixtures are the same PDFs the flow path is measured on.
 */
describe('sealing a bundle', () => {
	const fixture = (name: string): Uint8Array =>
		new Uint8Array(readFileSync(join(__dirname, '..', 'artifacts', 'form', 'fixtures', name)))

	const encodedPdf = fixture('auto-encoded.pdf')
	const cleanPdf = fixture('auto-clean.pdf')

	const FLOW_SLOTS: Record<string, SignatureSlot> = {
		'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' },
		'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'flow' },
	}

	/** Answers the marker pass with the encoded fixture and every other pass with the clean one. */
	const reactRenderer = (): ParadocRenderer<RendererLayer, Uint8Array> => ({
		id: 'react-stub',
		render: (request: RenderRequest<RendererLayer>) =>
			(request.ctx?.signing?.markers ?? []).length > 0 ? encodedPdf : cleanPdf,
	})

	/** A minimal TIFF, so a bytes entry declared image/tiff is one. */
	const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00])

	const contract = (name: string, role: string, signer: string) =>
		form()
			.name(name)
			.version('1.0.0')
			.title(name)
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ [role]: { label: role, types: ['person'], signature: { required: true } } })
			.fileLayer('composition', {
				mimeType: 'text/tsx',
				path: `${name}.tsx`,
				signatures: Object.fromEntries(
					Object.entries(FLOW_SLOTS).map(([id, slot]) => [id, { ...slot, party: { role } }]),
				) as Record<string, SignatureSlot>,
			})
			.defaultLayer('composition')
			.build()
			.fill({
				fields: { amount: 10 },
				parties: { [role]: { id: `${role}-0`, name: role } },
			})
			.addSigner(signer, { person: { name: role } })
			.addSignatory(role, `${role}-0`, { signerId: signer })

	const bundle: Bundle = {
		kind: 'bundle',
		name: 'two-part-packet',
		version: '1.0.0',
		title: 'Two part packet',
		contents: [
			{ type: 'inline', key: 'first', artifact: { kind: 'document', name: 'first', version: '1.0.0', title: 'First' } },
			{ type: 'inline', key: 'second', artifact: { kind: 'document', name: 'second', version: '1.0.0', title: 'Second' } },
			{ type: 'inline', key: 'annex', artifact: { kind: 'document', name: 'annex', version: '1.0.0', title: 'Annex' } },
		],
	}

	// Two roles and two signer ids, so the packet's remap and sort have two
	// signers to order rather than one repeated.
	const contents = (annex: { content: Uint8Array; mimeType: string; filename?: string }) => ({
		first: contract('first', 'client', 'client-signer'),
		second: contract('second', 'vendor', 'vendor-signer'),
		annex: { kind: 'bytes' as const, ...annex },
	})

	const seal = () =>
		sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({ content: cleanPdf, mimeType: 'application/pdf', filename: 'annex.pdf' }),
		})

	test('lays the parts out on contiguous packet pages, in bundle order', async () => {
		const packet = await seal()
		const pages = await pageTextRuns(packet.pdf)

		expect(packet.parts.map((part) => part.key)).toEqual(['first', 'second', 'annex'])
		let expected = 1
		for (const part of packet.parts) {
			expect(part.firstPage).toBe(expected)
			expect(part.attached).toBe(false)
			expected += part.pageCount
		}
		expect(pages).toHaveLength(expected - 1)
	})

	test('resolves every slot of every part onto a packet page', async () => {
		const packet = await seal()
		const first = new Map(packet.parts.map((part) => [part.key, part.firstPage]))

		expect(packet.signatureMap.map((field) => field.id)).toEqual([
			'first/client-sig',
			'first/client-ini',
			'second/client-sig',
			'second/client-ini',
		])
		for (const field of packet.signatureMap) {
			expect(field.page).toBe(field.partPage + first.get(field.part)! - 1)
			expect(field.width).toBeGreaterThan(0)
		}
		// The two parts are on different packet pages, so the same slot id in
		// each resolves to a different page.
		expect(packet.signatureMap[0]!.page).not.toBe(packet.signatureMap[2]!.page)
	})

	test('scopes every part signer, so the packet holds one per part', async () => {
		const packet = await seal()

		expect(packet.signers).toEqual([
			{ id: 'first/client-signer', index: 0, parts: ['first/client-signer'] },
			{ id: 'second/vendor-signer', index: 1, parts: ['second/vendor-signer'] },
		])
		expect(packet.signatureMap.map((field) => field.signerId)).toEqual([
			'first/client-signer',
			'first/client-signer',
			'second/vendor-signer',
			'second/vendor-signer',
		])
		expect(packet.signatureMap.map((field) => field.signerIndex)).toEqual([0, 0, 1, 1])
		// The part's own id is still readable, because that is what the part's
		// own seal bound.
		expect(packet.signatureMap.map((field) => field.partSignerId)).toEqual([
			'client-signer',
			'client-signer',
			'vendor-signer',
			'vendor-signer',
		])
	})

	test('treats the same bare signer id in two parts as two people', async () => {
		// Both parts bind `signer-1`. Nothing says they are the same person, and
		// a packet that assumed so would collect one signature for two.
		const packet = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: {
				first: contract('first', 'client', 'signer-1'),
				second: contract('second', 'vendor', 'signer-1'),
				annex: { kind: 'bytes', content: cleanPdf, mimeType: 'application/pdf' },
			},
		})

		expect(packet.signers.map((signer) => signer.id)).toEqual(['first/signer-1', 'second/signer-1'])
		expect(new Set(packet.signatureMap.map((field) => field.signerIndex))).toEqual(new Set([0, 1]))
	})

	test('merges two part signers into one only when the caller maps them', async () => {
		const packet = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			signers: {
				'first/client-signer': 'acme-principal',
				'second/vendor-signer': 'acme-principal',
			},
			contents: contents({ content: cleanPdf, mimeType: 'application/pdf' }),
		})

		expect(packet.signers).toEqual([
			{
				id: 'acme-principal',
				index: 0,
				parts: ['first/client-signer', 'second/vendor-signer'],
			},
		])
		expect(new Set(packet.signatureMap.map((field) => field.signerIndex))).toEqual(new Set([0]))
		expect(packet.signatureMap).toHaveLength(4)
	})

	test('refuses a signer mapping that names a signer no part binds', async () => {
		const failure = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			signers: { 'w-9/sb1': 'acme-principal' },
			contents: contents({ content: cleanPdf, mimeType: 'application/pdf' }),
		}).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as Error).message).toContain('names w-9/sb1, which no part binds')
		expect((failure as Error).message).toContain('first/client-signer')
	})

	test('hashes the merged document and the packet separately', async () => {
		const packet = await seal()
		expect(packet.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(packet.packetHash).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(packet.packetHash).not.toBe(packet.canonicalPdfHash)
	})

	test('carries an annex it cannot paint beside the document, with its own digest', async () => {
		const packet = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({ content: tiff, mimeType: 'image/tiff', filename: 'scan.tiff' }),
		})

		const annex = packet.parts.find((part) => part.key === 'annex')!
		expect(annex.attached).toBe(true)
		expect(annex.pageCount).toBe(0)
		expect(annex.firstPage).toBe(0)
		expect(annex.filename).toBe('scan.tiff')
		expect(annex.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
		// The attachment is not in the merged document, so only the packet hash
		// covers it. A different attachment is a different packet.
		const other = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({
				content: new Uint8Array([...tiff, 0x01]),
				mimeType: 'image/tiff',
				filename: 'scan.tiff',
			}),
		})
		expect(other.canonicalPdfHash).toBe(packet.canonicalPdfHash)
		expect(other.packetHash).not.toBe(packet.packetHash)
	})

	test('names every part it carried rather than merged', async () => {
		const packet = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({ content: tiff, mimeType: 'image/tiff', filename: 'scan.tiff' }),
		})
		expect(packet.warnings).toContain('annex: carried as an attachment because it is image/tiff, which the packet cannot paint')
	})

	test('carries an annex declared PDF whose bytes cannot be read, and says so', async () => {
		// A truncated PDF is still an upload somebody made. The packet names it
		// rather than aborting on a parser error about a byte offset.
		const truncated = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a])
		const packet = await sealBundle(bundle, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({ content: truncated, mimeType: 'application/pdf', filename: 'scan.pdf' }),
		})

		const annex = packet.parts.find((part) => part.key === 'annex')!
		expect(annex.attached).toBe(true)
		expect(packet.warnings.some((warning) => warning.startsWith('annex: carried as an attachment because its bytes could not be read as a PDF'))).toBe(true)
	})

	test('refuses a bundle with no entry for a content key', async () => {
		const failure = await sealBundle(bundle, { contents: {} }).catch((error: unknown) => error)
		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as BundleSealError).problems).toEqual([
			'bundle content "first" has no entry',
			'bundle content "second" has no entry',
			'bundle content "annex" has no entry',
		])
	})

	test('allows excluded members to remain without packet entries', async () => {
		const selective: Bundle = {
			...bundle,
			contents: [
				{ ...bundle.contents[0]!, include: true },
				{ ...bundle.contents[1]!, include: false },
				{ ...bundle.contents[2]!, include: false },
			],
		}
		const packet = await sealBundle(selective, {
			contents: { first: { kind: 'bytes', content: cleanPdf, mimeType: 'application/pdf' } },
		})

		expect(packet.parts.map((part) => part.key)).toEqual(['first'])
	})

	test('refuses a packet where nothing reached a PDF', async () => {
		const oneAnnex: Bundle = { ...bundle, contents: [bundle.contents[2]!] }
		const failure = await sealBundle(oneAnnex, {
			contents: { annex: { kind: 'bytes', content: tiff, mimeType: 'image/tiff' } },
		}).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as Error).message).toContain('no part reached a PDF')
	})

	test('refuses bytes that are not what the entry declares', async () => {
		const oneAnnex: Bundle = { ...bundle, contents: [bundle.contents[2]!] }
		const failure = await sealBundle(oneAnnex, {
			contents: { annex: { kind: 'bytes', content: tiff, mimeType: 'application/pdf' } },
		}).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as BundleSealError).problems).toEqual([
			'content for "annex" does not match its own declaration: it is declared application/pdf but its bytes begin with a image/tiff signature',
		])
	})

	test('refuses an artifact the bundle does not declare', async () => {
		const declaring: Bundle = {
			...bundle,
			contents: [
				{ type: 'registry', key: 'first', slug: '@acme/forms/other-contract' },
				bundle.contents[1]!,
				bundle.contents[2]!,
			],
		}
		const failure = await sealBundle(declaring, {
			renderers: { 'text/tsx': reactRenderer() },
			contents: contents({ content: cleanPdf, mimeType: 'application/pdf' }),
		}).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as BundleSealError).problems).toEqual([
			'content for "first" is the artifact "first" but the bundle declares "other-contract"',
		])
	})

	test('refuses a rendered part that is not a PDF, naming it', async () => {
		// A packet holds PDF pages. A part that rendered markdown is a
		// configuration fault, not an annex somebody uploaded.
		const markdown = form()
			.name('notice')
			.version('1.0.0')
			.title('Notice')
			.fields({ body: { type: 'text', label: 'Body', required: true } })
			.inlineLayer('markdown', { mimeType: 'text/markdown', text: '{{body}}' })
			.defaultLayer('markdown')
			.build()
			.fill({ fields: { body: 'a notice' } })

		const oneRendered: Bundle = {
			...bundle,
			contents: [{ type: 'inline', key: 'first', artifact: { kind: 'document', name: 'notice', version: '1.0.0', title: 'Notice' } }],
		}
		const failure = await sealBundle(oneRendered, { contents: { first: markdown } }).catch(
			(error: unknown) => error,
		)

		expect(failure).toBeInstanceOf(SealConfigError)
		expect((failure as Error).message).toContain('part "first" rendered text/markdown')
	})

	test('names the part a render failed in', async () => {
		const failing: ParadocRenderer<RendererLayer, Uint8Array> = {
			id: 'broken',
			render: () => {
				throw new Error('the engine gave up')
			},
		}
		const failure = await sealBundle(bundle, {
			renderers: { 'text/tsx': failing },
			contents: contents({ content: cleanPdf, mimeType: 'application/pdf' }),
		}).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(BundleSealError)
		expect((failure as BundleSealError).part).toBe('first')
		expect((failure as Error).message).toContain('sealing part "first" failed: the engine gave up')
	})
})

describe('assembling a bundle', () => {
	const bundle: Bundle = {
		kind: 'bundle',
		name: 'one-part',
		version: '1.0.0',
		title: 'One part',
		contents: [
			{ type: 'inline', key: 'composition', artifact: { kind: 'document', name: 'c', version: '1.0.0', title: 'C' } },
			{ type: 'inline', key: 'annex', artifact: { kind: 'document', name: 'a', version: '1.0.0', title: 'A' } },
		],
	}

	const draft = form()
		.name('composed')
		.version('1.0.0')
		.title('Composed')
		.fields({ amount: { type: 'number', label: 'Amount', required: true } })
		.fileLayer('composition', { mimeType: 'text/tsx', path: 'composed.tsx' })
		.defaultLayer('composition')
		.build()
		.fill({ fields: { amount: 1 } })

	const pdf = new TextEncoder().encode('%PDF-1.7 stand-in')

	test('names a React part by what its renderer produced, not by the layer', async () => {
		const assembled = await assembleBundle(bundle, {
			renderers: {
				'text/tsx': { id: 'stub', render: () => pdf } as ParadocRenderer<RendererLayer, Uint8Array>,
			},
			contents: {
				composition: draft,
				annex: { kind: 'bytes', content: pdf, mimeType: 'application/pdf', filename: 'annex.pdf' },
			},
		})

		// The layer is text/tsx and the output is a PDF, so a `.bin` filename
		// would name the packet's part after the module that drew it.
		expect(assembled.outputs.composition).toMatchObject({
			mimeType: 'application/pdf',
			filename: 'composition.pdf',
		})
		expect(assembled.outputs.annex).toMatchObject({
			content: pdf,
			mimeType: 'application/pdf',
			filename: 'annex.pdf',
		})
	})

	test('names a bytes entry after its key when it carries no filename', async () => {
		const assembled = await assembleBundle(bundle, {
			contents: { annex: { kind: 'bytes', content: pdf, mimeType: 'application/pdf' } },
		})
		expect(assembled.outputs.annex!.filename).toBe('annex.pdf')
	})
})

/**
 * A packet takes no resolver of its own.
 *
 * Its parts are artifact instances, and each one carries the resolver it was
 * constructed with. That is the whole reason the bundle-level option is gone,
 * so it is worth pinning both halves: a bound part reads its file layer, and
 * an unbound one fails naming itself rather than reaching for a resolver the
 * packet was never given.
 */
describe('a packet whose parts carry their own resolvers', () => {
	const pdf = new Uint8Array(
		readFileSync(join(__dirname, '..', 'artifacts', 'form', 'fixtures', 'auto-clean.pdf')),
	)

	/** A one-slot contract whose PDF layer is file-backed, so it needs a resolver. */
	const fileBackedContract = (name: string, options?: { resolver: { read(path: string): Promise<Uint8Array> } }) =>
		form()
			.name(name)
			.version('1.0.0')
			.title(name)
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'client', types: ['person'], signature: { required: true } } })
			.fileLayer('pdf', {
				mimeType: 'application/pdf',
				path: `${name}.pdf`,
				signatures: {
					'client-sig': {
						party: { role: 'client' },
						type: 'signature',
						placement: { page: 1, x: 50, y: 200, width: 120, height: 30 },
					},
				},
			})
			.defaultLayer('pdf')
			.build(options)
			.fill({ fields: { amount: 10 }, parties: { client: { id: 'client-0', name: 'client' } } })
			.addSigner(`${name}-signer`, { person: { name: 'client' } })
			.addSignatory('client', 'client-0', { signerId: `${name}-signer` })

	const twoParts: Bundle = {
		kind: 'bundle',
		name: 'mixed-binding-packet',
		version: '1.0.0',
		title: 'Mixed binding packet',
		contents: [
			{ type: 'inline', key: 'bound', artifact: { kind: 'document', name: 'bound', version: '1.0.0', title: 'Bound' } },
			{ type: 'inline', key: 'unbound', artifact: { kind: 'document', name: 'unbound', version: '1.0.0', title: 'Unbound' } },
		],
	}

	const resolver = { read: async (): Promise<Uint8Array> => pdf }

	test('seals a part whose resolver is bound, and fails on the one whose is not', async () => {
		const error = await sealBundle(twoParts, {
			contents: {
				bound: fileBackedContract('bound', { resolver }),
				unbound: fileBackedContract('unbound'),
			},
		}).then(
			() => undefined,
			(err: unknown) => err,
		)

		// The bound part is first in bundle order and sealed without complaint;
		// the failure belongs to the second, and says so.
		expect(error).toBeInstanceOf(BundleSealError)
		const failure = error as BundleSealError
		expect(failure.part).toBe('unbound')
		expect(failure.message).toContain('sealing part "unbound" failed')
		expect(failure.cause).toBeInstanceOf(UnboundResolverError)
		expect((failure.cause as UnboundResolverError).site).toBe('artifact')
		expect((failure.cause as UnboundResolverError).path).toBe('unbound.pdf')
	})

	test('seals both parts once both are bound', async () => {
		const packet = await sealBundle(twoParts, {
			contents: {
				bound: fileBackedContract('bound', { resolver }),
				unbound: fileBackedContract('unbound', { resolver }),
			},
		})

		expect(packet.parts.map((part) => part.key)).toEqual(['bound', 'unbound'])
		expect(packet.signatureMap.map((field) => field.id)).toEqual(['bound/client-sig', 'unbound/client-sig'])
	})
})
