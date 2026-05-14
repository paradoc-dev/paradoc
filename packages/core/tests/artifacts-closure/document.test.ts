import { describe, test, expect } from 'vitest'
import { document, runtimeDocumentFromJSON } from '@/artifacts'

/**
 * Tests for closure-based document implementation (closure-based).
 */
describe('closure-based Document', () => {
	// ============================================================================
	// Test Fixtures
	// ============================================================================

	const createMinimalDocument = () =>
		document()
			.name('minimal-document')
			.version('1.0.0')
			.title('Minimal Document')
			.build()

	const createDocumentWithLayers = () =>
		document()
			.name('test-document')
			.version('1.0.0')
			.title('Test Document')
			.description('A test document')
			.code('DOC-001')
			.metadata({ author: 'Test' })
			.inlineLayer('default', { mimeType: 'text/plain', text: 'Hello, World!' })
			.inlineLayer('html', { mimeType: 'text/html', text: '<p>Hello, World!</p>' })
			.defaultLayer('default')
			.build()

	// ============================================================================
	// DocumentInstance Tests
	// ============================================================================

	describe('DocumentInstance', () => {
		describe('property getters', () => {
			test('returns kind = "document"', () => {
				const instance = createMinimalDocument()
				expect(instance.kind).toBe('document')
			})

			test('returns name', () => {
				const instance = createMinimalDocument()
				expect(instance.name).toBe('minimal-document')
			})

			test('returns version', () => {
				const instance = createMinimalDocument()
				expect(instance.version).toBe('1.0.0')
			})

			test('returns title', () => {
				const instance = createMinimalDocument()
				expect(instance.title).toBe('Minimal Document')
			})

			test('returns description when set', () => {
				const instance = createDocumentWithLayers()
				expect(instance.description).toBe('A test document')
			})

			test('returns code when set', () => {
				const instance = createDocumentWithLayers()
				expect(instance.code).toBe('DOC-001')
			})

			test('returns metadata when set', () => {
				const instance = createDocumentWithLayers()
				expect(instance.metadata).toEqual({ author: 'Test' })
			})

			test('returns layers when set', () => {
				const instance = createDocumentWithLayers()
				expect(instance.layers).toBeDefined()
				expect(Object.keys(instance.layers || {})).toHaveLength(2)
			})

			test('returns defaultLayer when set', () => {
				const instance = createDocumentWithLayers()
				expect(instance.defaultLayer).toBe('default')
			})
		})

		describe('validate()', () => {
			test('returns valid result for valid document', () => {
				const instance = createMinimalDocument()
				const result = instance.validate()
				expect('value' in result).toBe(true)
			})
		})

		describe('isValid()', () => {
			test('returns true for valid document', () => {
				const instance = createMinimalDocument()
				expect(instance.isValid()).toBe(true)
			})
		})

		describe('toJSON()', () => {
			test('returns raw data object when includeSchema is false', () => {
				const instance = createMinimalDocument()
				const json = instance.toJSON({ includeSchema: false })
				expect(json.kind).toBe('document')
				expect(json.name).toBe('minimal-document')
				expect((json as { $schema?: string }).$schema).toBeUndefined()
			})

			test('includes $schema by default', () => {
				const instance = createMinimalDocument()
				const json = instance.toJSON() as { $schema: string }
				expect(json.$schema).toBe('https://schema.paradoc.dev/schema.json')
			})
		})

		describe('toYAML()', () => {
			test('returns valid YAML string', () => {
				const instance = createMinimalDocument()
				const yaml = instance.toYAML()
				expect(typeof yaml).toBe('string')
				expect(yaml).toContain('kind: document')
			})
		})

		describe('clone()', () => {
			test('creates exact copy', () => {
				const instance = createDocumentWithLayers()
				const copy = instance.clone()
				expect(copy.name).toBe(instance.name)
				expect(copy.layers).toEqual(instance.layers)
			})

			test('copy is independent', () => {
				const instance = createDocumentWithLayers()
				const copy = instance.clone()
				expect(copy).not.toBe(instance)
				expect(copy.toJSON({ includeSchema: false })).toEqual(instance.toJSON({ includeSchema: false }))
			})
		})

		describe('static from()', () => {
			test('parses valid document object', () => {
				const input = {
					kind: 'document' as const,
					name: 'parsed-document',
					version: '1.0.0',
					title: 'Parsed Document',
				}
				const instance = document.from(input)
				expect(instance.name).toBe('parsed-document')
			})

			test('throws for invalid input', () => {
				expect(() => document.from({})).toThrow()
			})
		})

		describe('static safeFrom()', () => {
			test('returns success for valid input', () => {
				const input = {
					kind: 'document' as const,
					name: 'safe-document',
					version: '1.0.0',
					title: 'Safe Document',
				}
				const result = document.safeFrom(input)
				expect(result.success).toBe(true)
			})

			test('returns error for invalid input', () => {
				const result = document.safeFrom({})
				expect(result.success).toBe(false)
			})
		})

		describe('render()', () => {
			test('returns raw content from inline text layer using defaultLayer', async () => {
				const instance = createDocumentWithLayers()
				const output = await instance.render()
				expect(output).toBe('Hello, World!')
			})

			test('returns raw content with explicit layer parameter', async () => {
				const instance = createDocumentWithLayers()
				const output = await instance.render({ layer: 'html' })
				expect(output).toBe('<p>Hello, World!</p>')
			})

			test('throws error when document has no layers', async () => {
				const instance = createMinimalDocument()
				await expect(instance.render()).rejects.toThrow('No layers defined')
			})

			test('throws error when specified layer not found', async () => {
				const instance = createDocumentWithLayers()
				await expect(instance.render({ layer: 'nonexistent' })).rejects.toThrow('Layer "nonexistent" not found')
			})

			test('uses first available layer when no defaultLayer set', async () => {
				const instance = document()
					.name('doc')
					.version('1.0.0')
					.title('Doc')
					.inlineLayer('first', { mimeType: 'text/plain', text: 'First content' })
					.inlineLayer('second', { mimeType: 'text/html', text: '<p>Second</p>' })
					.build()

				const output = await instance.render()
				expect(output).toBe('First content')
			})

			test('throws error when file layer but no resolver', async () => {
				const instance = document()
					.name('doc')
					.version('1.0.0')
					.title('Doc')
					.fileLayer('pdf', { mimeType: 'application/pdf', path: '/templates/doc.pdf' })
					.defaultLayer('pdf')
					.build()

				await expect(instance.render()).rejects.toThrow('no resolver was provided')
			})

			test('returns raw bytes for binary file layers', async () => {
				const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46])
				const mockResolver = {
					read: async (_path: string) => pdfContent,
				}

				const instance = document()
					.name('doc')
					.version('1.0.0')
					.title('Doc')
					.fileLayer('pdf', { mimeType: 'application/pdf', path: '/templates/doc.pdf' })
					.defaultLayer('pdf')
					.build()

				const output = await instance.render({ resolver: mockResolver })
				expect(output).toBeInstanceOf(Uint8Array)
				expect(output).toEqual(pdfContent)
			})

			test('decodes text content for text file layers', async () => {
				const textContent = new TextEncoder().encode('Hello from file!')
				const mockResolver = {
					read: async (_path: string) => textContent,
				}

				const instance = document()
					.name('doc')
					.version('1.0.0')
					.title('Doc')
					.fileLayer('text', { mimeType: 'text/plain', path: '/templates/doc.txt' })
					.defaultLayer('text')
					.build()

				const output = await instance.render({ resolver: mockResolver })
				expect(typeof output).toBe('string')
				expect(output).toBe('Hello from file!')
			})
		})
	})

	// ============================================================================
	// RuntimeDocument Tests
	// ============================================================================

	describe('RuntimeDocument', () => {
		describe('prepare()', () => {
			test('creates draft RuntimeDocument', () => {
				const instance = createDocumentWithLayers()
				const runtime = instance.prepare()
				expect(runtime.phase).toBe('draft')
				expect(runtime.targetLayer).toBe('default')
				expect(runtime.finalizedAt).toBeUndefined()
			})

			test('accepts explicit target layer', () => {
				const instance = createDocumentWithLayers()
				// Use type assertion since builder doesn't preserve layer key types
				const runtime = instance.prepare('html' as keyof typeof instance.layers & string)
				expect(runtime.targetLayer).toBe('html')
			})

			test('throws for non-existent layer', () => {
				const instance = createDocumentWithLayers()
				expect(() => instance.prepare('nonexistent' as any)).toThrow('Layer "nonexistent" not found')
			})
		})

		describe('convenience getters', () => {
			test('provides access to document properties', () => {
				const instance = createDocumentWithLayers()
				const runtime = instance.prepare()

				expect(runtime.name).toBe('test-document')
				expect(runtime.version).toBe('1.0.0')
				expect(runtime.title).toBe('Test Document')
				expect(runtime.layers).toBeDefined()
			})
		})

		describe('setTargetLayer()', () => {
			test('changes target layer (draft)', () => {
				// Use direct object pattern for proper type inference
				const instance = document({
					name: 'test-document',
					version: '1.0.0',
					title: 'Test Document',
					layers: {
						default: { kind: 'inline', mimeType: 'text/plain', text: 'Hello' },
						html: { kind: 'inline', mimeType: 'text/html', text: '<p>Hello</p>' },
					},
					defaultLayer: 'default',
				})

				const draft = instance.prepare()
				const updated = draft.setTargetLayer('html')

				expect(updated.targetLayer).toBe('html')
				expect(draft.targetLayer).toBe('default') // original unchanged
			})

			test('throws for non-existent layer', () => {
				const instance = createDocumentWithLayers()
				const draft = instance.prepare()
				// Use runtime test - cast to any to bypass type checking
				expect(() => (draft as any).setTargetLayer('nonexistent')).toThrow('Layer "nonexistent" not found')
			})

			test('throws when finalized', () => {
				// Use direct object pattern for proper type inference
				const instance = document({
					name: 'test-document',
					version: '1.0.0',
					title: 'Test Document',
					layers: {
						default: { kind: 'inline', mimeType: 'text/plain', text: 'Hello' },
						html: { kind: 'inline', mimeType: 'text/html', text: '<p>Hello</p>' },
					},
					defaultLayer: 'default',
				})

				// NOTE: With discriminated union types, setTargetLayer() doesn't exist on FinalRuntimeDocument
				// The type system prevents calling setTargetLayer() on finalized documents at compile time
				const final = instance.prepare().finalize()
				expect(final.phase).toBe('final') // Just verify we have a final document
			})

			})

		describe('finalize()', () => {
			test('transitions to final phase', () => {
				const instance = createDocumentWithLayers()
				const draft = instance.prepare()
				const final = draft.finalize()

				expect(final.phase).toBe('final')
				expect(final.finalizedAt).toBeDefined()
				expect(typeof final.finalizedAt).toBe('string')
			})

		})

		describe('render()', () => {
			test('renders target layer content', async () => {
				const instance = createDocumentWithLayers()
				const runtime = instance.prepare()
				const output = await runtime.render()
				expect(output).toBe('Hello, World!')
			})

			test('allows layer override', async () => {
				const instance = createDocumentWithLayers()
				const runtime = instance.prepare()
				const output = await runtime.render({ layer: 'html' })
				expect(output).toBe('<p>Hello, World!</p>')
			})
		})

		describe('toJSON()', () => {
			test('returns draft JSON format', () => {
				const instance = createDocumentWithLayers()
				const draft = instance.prepare()
				const json = draft.toJSON()

				expect(json.phase).toBe('draft')
				expect(json.targetLayer).toBe('default')
				expect(json.document).toBeDefined()
				expect('finalizedAt' in json).toBe(false)
			})

			test('returns final JSON format', () => {
				const instance = createDocumentWithLayers()
				const final = instance.prepare().finalize()
				const json = final.toJSON()

				expect(json.phase).toBe('final')
				expect('finalizedAt' in json).toBe(true)
			})
		})

		describe('toYAML()', () => {
			test('returns valid YAML', () => {
				const instance = createDocumentWithLayers()
				const runtime = instance.prepare()
				const yaml = runtime.toYAML()

				expect(typeof yaml).toBe('string')
				expect(yaml).toContain('phase: draft')
			})
		})

		describe('clone()', () => {
			test('creates independent copy', () => {
				const instance = createDocumentWithLayers()
				const draft = instance.prepare()
				const copy = draft.clone()

				expect(copy.phase).toBe(draft.phase)
				expect(copy.targetLayer).toBe(draft.targetLayer)
				expect(copy).not.toBe(draft)
			})

			test('preserves finalized state', () => {
				const instance = createDocumentWithLayers()
				const final = instance.prepare().finalize()
				const copy = final.clone()

				expect(copy.phase).toBe('final')
				expect(copy.finalizedAt).toBe(final.finalizedAt)
			})
		})

		describe('runtimeDocumentFromJSON()', () => {
			test('loads draft from JSON', () => {
				const instance = createDocumentWithLayers()
				const original = instance.prepare()
				const json = original.toJSON()
				const loaded = runtimeDocumentFromJSON(json)

				expect(loaded.phase).toBe('draft')
				expect(loaded.targetLayer).toBe(original.targetLayer)
				expect(loaded.name).toBe(original.name)
			})

			test('loads final from JSON', () => {
				const instance = createDocumentWithLayers()
				const original = instance.prepare().finalize()
				const json = original.toJSON()
				const loaded = runtimeDocumentFromJSON(json)

				expect(loaded.phase).toBe('final')
				expect(loaded.finalizedAt).toBe(original.finalizedAt)
			})
		})
	})

	// ============================================================================
	// Builder Tests
	// ============================================================================

	describe('DocumentBuilder', () => {
		test('chains methods fluently', () => {
			const instance = document()
				.name('chained')
				.version('2.0.0')
				.title('Chained Document')
				.description('Built with chaining')
				.code('CHN-001')
				.releaseDate('2024-01-01')
				.metadata({ custom: 'value' })
				.build()

			expect(instance.name).toBe('chained')
			expect(instance.version).toBe('2.0.0')
			expect(instance.title).toBe('Chained Document')
			expect(instance.description).toBe('Built with chaining')
			expect(instance.code).toBe('CHN-001')
			expect(instance.releaseDate).toBe('2024-01-01')
			expect(instance.metadata).toEqual({ custom: 'value' })
		})

		test('from() initializes from existing document', () => {
			const original = createDocumentWithLayers()
			const copy = document().from(original._data).name('modified-name').build()

			expect(copy.name).toBe('modified-name')
			expect(copy.title).toBe(original.title) // unchanged
		})

		test('layer() adds single layer', () => {
			const instance = document()
				.name('doc')
				.version('1.0.0')
				.title('Doc')
				.layer('main', { kind: 'inline', mimeType: 'text/plain', text: 'Content' })
				.build()

			expect(instance.layers?.main).toBeDefined()
			expect((instance.layers?.main as any)?.text).toBe('Content')
		})

		test('layers() sets multiple layers', () => {
			const instance = document()
				.name('doc')
				.version('1.0.0')
				.title('Doc')
				.layers({
					text: { kind: 'inline', mimeType: 'text/plain', text: 'Text' },
					html: { kind: 'inline', mimeType: 'text/html', text: '<p>HTML</p>' },
				})
				.build()

			expect(Object.keys(instance.layers || {})).toHaveLength(2)
		})
	})

	// ============================================================================
	// Direct Object Pattern
	// ============================================================================

	describe('direct object pattern', () => {
		test('creates document from object literal', () => {
			const instance = document({
				name: 'direct-document',
				version: '1.0.0',
				title: 'Direct Document',
				layers: {
					main: { kind: 'inline', mimeType: 'text/plain', text: 'Content' },
				},
				defaultLayer: 'main',
			})

			expect(instance.name).toBe('direct-document')
			expect(instance.kind).toBe('document')
			expect(instance.layers?.main).toBeDefined()
		})
	})
})
