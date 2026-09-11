import { describe, test, expect } from 'vitest'
import { form, p, renderLayer, UnboundResolverError } from '@/artifacts'
import { BundleResolverError, loadFromObject } from '@/serialization'
import { createMemoryResolver } from '@paradoc/resolvers/memory'

/**
 * The resolver is bound when the form is constructed, so every instance
 * derived from that one carries it.
 *
 * A runtime form is immutable by reconstruction: `addSigner`, `setField`,
 * `setTargetLayer` and every other mutator build a fresh form from the config.
 * A resolver that arrived with a render call would not survive the next
 * mutator, which is why there is no per-call resolver.
 */
describe('a resolver bound at construction', () => {
	const MINIMAL_PDF = Uint8Array.from(
		Buffer.from(
			'JVBERi0xLjUKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMzAwXSAvUmVzb3VyY2VzIDw8ID4+ID4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjAzCiUlRU9GCg==',
			'base64',
		),
	)

	const definition = {
		kind: 'form' as const,
		name: 'bound-resolver-form',
		version: '1.0.0',
		title: 'Bound Resolver Form',
		fields: {
			name: { type: 'text' as const, label: 'Name' },
		},
		parties: {
			signer: {
				label: 'Signer',
				partyType: 'person' as const,
				signature: { required: true },
			},
		},
		layers: {
			markdown: {
				kind: 'file' as const,
				mimeType: 'text/markdown',
				path: 'bound.md',
			},
			pdf: {
				kind: 'file' as const,
				mimeType: 'application/pdf',
				path: 'bound.pdf',
				signatureBlocks: {
					'signer-signature': {
						type: 'signature' as const,
						page: 1,
						x: 50,
						y: 200,
						width: 120,
						height: 30,
						partyRole: 'signer',
					},
				},
			},
		},
		defaultLayer: 'markdown',
	}

	const resolver = createMemoryResolver({
		contents: {
			'bound.md': 'Name: {{name}}',
			'bound.pdf': MINIMAL_PDF,
		},
	})

	const filled = () =>
		p
			.form(definition, { resolver })
			.fill({
				fields: { name: 'Ada' },
				parties: { signer: { id: 'signer-0', name: 'Ada' } },
			})

	test('survives a mutator on the way to render', async () => {
		const output = await filled()
			.addSigner('ada', { person: { name: 'Ada' } })
			.render({ layer: 'markdown' })

		expect(output).toContain('Ada')
	})

	test('survives a mutator on the way to seal', async () => {
		const sealed = await filled()
			.addSigner('ada', { person: { name: 'Ada' } })
			.addSignatory('signer', 'signer-0', { signerId: 'ada' })
			.setTargetLayer('pdf')
			.seal()

		expect(sealed.canonicalPdfHash).toMatch(/^sha256:[a-f0-9]{64}$/)
		expect(sealed.signatureMap).toHaveLength(1)
	})

	test('survives a clone, which cannot structurally copy a function', async () => {
		const output = await filled().clone().render({ layer: 'markdown' })

		expect(output).toContain('Ada')
	})

	test('reaches the form instance render as well as the runtime one', async () => {
		const output = await p
			.form(definition, { resolver })
			.render({ data: { name: 'Grace' }, layer: 'markdown' })

		expect(output).toContain('Grace')
	})

	test('is absent by name when the form was constructed without one', async () => {
		const unbound = form.from(definition).fill({
			fields: { name: 'Ada' },
			parties: { signer: { id: 'signer-0', name: 'Ada' } },
		})

		await expect(unbound.render({ layer: 'markdown' })).rejects.toThrow(UnboundResolverError)
		await expect(unbound.render({ layer: 'markdown' })).rejects.toThrow(
			/no resolver is bound to this artifact/,
		)
	})

	test('reaches a form loaded from an object', async () => {
		const loaded = loadFromObject(definition as { kind: 'form' }, { resolver })
		const output = await loaded
			.fill({ fields: { name: 'Ada' }, parties: { signer: { id: 'signer-0', name: 'Ada' } } })
			.addSigner('ada', { person: { name: 'Ada' } })
			.render({ layer: 'markdown' })

		expect(output).toContain('Ada')
	})
})

/**
 * The free `renderLayer` primitive reads a bare layers record, so there is no
 * artifact for a resolver to have been bound to and the remedy is a different
 * sentence. The CLI is a live caller: it renders a layer of an artifact it has
 * only parsed.
 */
describe('the free layer primitive', () => {
	const layers = {
		markdown: { kind: 'file' as const, mimeType: 'text/markdown', path: 'free.md' },
	}

	test('reads the layer with the resolver its own options carry', async () => {
		const output = await renderLayer(layers, 'markdown', {
			resolver: { read: async () => new TextEncoder().encode('free bytes') },
		})

		expect(output).toBe('free bytes')
	})

	test('names its own remedy when the options carry none', async () => {
		const failure = await renderLayer(layers, 'markdown').then(
			() => undefined,
			(err: unknown) => err as UnboundResolverError,
		)

		expect(failure).toBeInstanceOf(UnboundResolverError)
		expect(failure!.site).toBe('layers')
		// Never the artifact remedy: nothing here was constructed.
		expect(failure!.message).not.toContain('bound to this artifact')
		expect(failure!.message).toContain('pass one in its options')
	})
})

/**
 * A bundle binds no resolver, so it refuses one rather than dropping it. The
 * typed `<'bundle'>` overloads take no options at all; this is the untyped
 * path, where the kind is only known once the object has been read.
 */
describe('a bundle offered a resolver', () => {
	const resolver = { read: async (): Promise<Uint8Array> => new Uint8Array() }

	const bundleDefinition = {
		kind: 'bundle' as const,
		name: 'refusing-bundle',
		version: '1.0.0',
		title: 'Refusing bundle',
		contents: [
			{
				type: 'inline' as const,
				key: 'part',
				artifact: { kind: 'document' as const, name: 'part', version: '1.0.0', title: 'Part' },
			},
		],
	}

	test('refuses it by name', () => {
		expect(() => loadFromObject(bundleDefinition as unknown, { resolver })).toThrow(BundleResolverError)
	})

	test('loads without one', () => {
		expect(loadFromObject(bundleDefinition as unknown).kind).toBe('bundle')
	})
})
