import { describe, test, expect } from 'vitest'
import { checklist, runtimeChecklistFromJSON } from '@/artifacts'

/**
 * Tests for closure-based checklist implementation (closure-based).
 */
describe('closure-based Checklist', () => {
	// ============================================================================
	// Test Fixtures
	// ============================================================================

	const createMinimalChecklist = () =>
		checklist()
			.name('minimal-checklist')
			.version('1.0.0')
			.title('Minimal Checklist')
			.build()

	const createChecklistWithItems = () =>
		checklist()
			.name('test-checklist')
			.version('1.0.0')
			.title('Test Checklist')
			.description('A test checklist')
			.code('CL-001')
			.metadata({ author: 'Test' })
			.item({ id: 'item1', title: 'First Item' })
			.item({ id: 'item2', title: 'Second Item' })
			.inlineLayer('default', { mimeType: 'text/plain', text: 'Checklist content' })
			.defaultLayer('default')
			.build()

	const createChecklistWithMixedStatus = () =>
		checklist()
			.name('mixed-status-checklist')
			.version('1.0.0')
			.title('Mixed Status Checklist')
			.itemWithBooleanStatus('reviewed', 'Document reviewed')
			.itemWithEnumStatus('approval', 'Approval Status', {
				statusOptions: [
					{ value: 'pending', label: 'Pending' },
					{ value: 'approved', label: 'Approved' },
					{ value: 'rejected', label: 'Rejected' },
				],
			})
			.inlineLayer('default', { mimeType: 'text/plain', text: 'Content' })
			.defaultLayer('default')
			.build()

	// ============================================================================
	// ChecklistInstance Tests
	// ============================================================================

	describe('ChecklistInstance', () => {
		describe('property getters', () => {
			test('returns kind = "checklist"', () => {
				const instance = createMinimalChecklist()
				expect(instance.kind).toBe('checklist')
			})

			test('returns name', () => {
				const instance = createMinimalChecklist()
				expect(instance.name).toBe('minimal-checklist')
			})

			test('returns version', () => {
				const instance = createMinimalChecklist()
				expect(instance.version).toBe('1.0.0')
			})

			test('returns title', () => {
				const instance = createMinimalChecklist()
				expect(instance.title).toBe('Minimal Checklist')
			})

			test('returns description when set', () => {
				const instance = createChecklistWithItems()
				expect(instance.description).toBe('A test checklist')
			})

			test('returns code when set', () => {
				const instance = createChecklistWithItems()
				expect(instance.code).toBe('CL-001')
			})

			test('returns metadata when set', () => {
				const instance = createChecklistWithItems()
				expect(instance.metadata).toEqual({ author: 'Test' })
			})

			test('returns items', () => {
				const instance = createChecklistWithItems()
				expect(instance.items).toBeDefined()
				expect(instance.items).toHaveLength(2)
			})

			test('returns layers when set', () => {
				const instance = createChecklistWithItems()
				expect(instance.layers).toBeDefined()
				expect(Object.keys(instance.layers || {})).toHaveLength(1)
			})

			test('returns defaultLayer when set', () => {
				const instance = createChecklistWithItems()
				expect(instance.defaultLayer).toBe('default')
			})
		})

		describe('validate()', () => {
			test('returns valid result for valid checklist', () => {
				const instance = createMinimalChecklist()
				const result = instance.validate()
				expect('value' in result).toBe(true)
			})
		})

		describe('isValid()', () => {
			test('returns true for valid checklist', () => {
				const instance = createMinimalChecklist()
				expect(instance.isValid()).toBe(true)
			})
		})

		describe('toJSON()', () => {
			test('returns raw data object when includeSchema is false', () => {
				const instance = createMinimalChecklist()
				const json = instance.toJSON({ includeSchema: false })
				expect(json.kind).toBe('checklist')
				expect(json.name).toBe('minimal-checklist')
				expect((json as { $schema?: string }).$schema).toBeUndefined()
			})

			test('includes $schema by default', () => {
				const instance = createMinimalChecklist()
				const json = instance.toJSON() as { $schema: string }
				expect(json.$schema).toBe('https://schema.paradoc.dev/schema.json')
			})
		})

		describe('toYAML()', () => {
			test('returns valid YAML string', () => {
				const instance = createMinimalChecklist()
				const yaml = instance.toYAML()
				expect(typeof yaml).toBe('string')
				expect(yaml).toContain('kind: checklist')
			})
		})

		describe('clone()', () => {
			test('creates exact copy', () => {
				const instance = createChecklistWithItems()
				const copy = instance.clone()
				expect(copy.name).toBe(instance.name)
				expect(copy.items).toEqual(instance.items)
			})

			test('copy is independent', () => {
				const instance = createChecklistWithItems()
				const copy = instance.clone()
				expect(copy).not.toBe(instance)
				expect(copy.toJSON({ includeSchema: false })).toEqual(instance.toJSON({ includeSchema: false }))
			})
		})

		describe('static from()', () => {
			test('parses valid checklist object', () => {
				const input = {
					kind: 'checklist' as const,
					name: 'parsed-checklist',
					version: '1.0.0',
					title: 'Parsed Checklist',
					items: [],
				}
				const instance = checklist.from(input)
				expect(instance.name).toBe('parsed-checklist')
			})

			test('throws for invalid input', () => {
				expect(() => checklist.from({})).toThrow()
			})
		})

		describe('static safeFrom()', () => {
			test('returns success for valid input', () => {
				const input = {
					kind: 'checklist' as const,
					name: 'safe-checklist',
					version: '1.0.0',
					title: 'Safe Checklist',
					items: [],
				}
				const result = checklist.safeFrom(input)
				expect(result.success).toBe(true)
			})

			test('returns error for invalid input', () => {
				const result = checklist.safeFrom({})
				expect(result.success).toBe(false)
			})
		})

		describe('render()', () => {
			test('returns raw content from inline text layer', async () => {
				const instance = createChecklistWithItems()
				const output = await instance.render()
				expect(output).toBe('Checklist content')
			})

			test('throws error when checklist has no layers', async () => {
				const instance = createMinimalChecklist()
				await expect(instance.render()).rejects.toThrow('Checklist has no layers defined')
			})
		})
	})

	// ============================================================================
	// RuntimeChecklist Tests - Fill and Lifecycle
	// ============================================================================

	describe('RuntimeChecklist', () => {
		describe('fill()', () => {
			test('creates draft RuntimeChecklist with item data', () => {
				const instance = createChecklistWithItems()
				// Builder doesn't preserve item types, use type assertion
				const runtime = instance.fill({ item1: true, item2: false } as any)

				expect(runtime.phase).toBe('draft')
				expect(runtime.completedAt).toBeUndefined()
			})

			test('validates boolean item values', () => {
				const instance = createChecklistWithMixedStatus()
				expect(() =>
					instance.fill({
						reviewed: 'invalid' as any, // should be boolean
						approval: 'pending',
					} as any),
				).toThrow('expected boolean')
			})

			test('validates enum item values', () => {
				const instance = createChecklistWithMixedStatus()
				expect(() =>
					instance.fill({
						reviewed: true,
						approval: 'invalid', // not in enum
					} as any),
				).toThrow('not in')
			})

			test('rejects unknown item IDs', () => {
				const instance = createChecklistWithItems()
				expect(() =>
					instance.fill({
						item1: true,
						item2: true,
						unknown: true, // not defined
					} as any),
				).toThrow('Unknown item "unknown"')
			})
		})

		describe('safeFill()', () => {
			test('returns success for valid data', () => {
				const instance = createChecklistWithItems()
				const result = instance.safeFill({ item1: true, item2: false } as any)

				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.phase).toBe('draft')
				}
			})

			test('returns error for invalid data', () => {
				const instance = createChecklistWithMixedStatus()
				const result = instance.safeFill({
					reviewed: 'invalid' as any,
					approval: 'pending',
				} as any)

				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error.message).toContain('expected boolean')
				}
			})
		})

		describe('convenience getters', () => {
			test('provides access to checklist properties', () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)

				expect(runtime.name).toBe('test-checklist')
				expect(runtime.version).toBe('1.0.0')
				expect(runtime.title).toBe('Test Checklist')
				expect(runtime.items).toHaveLength(2)
				expect(runtime.layers).toBeDefined()
			})
		})

		describe('getItem()', () => {
			test('returns item value', () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)

				expect(runtime.getItem('item1' as any)).toBe(true)
				expect(runtime.getItem('item2' as any)).toBe(false)
			})

			test('throws for unknown item', () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)

				expect(() => runtime.getItem('unknown' as any)).toThrow('Unknown item "unknown"')
			})
		})

		describe('getAllItems()', () => {
			test('returns all item values', () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)

				expect(runtime.getAllItems()).toEqual({ item1: true, item2: false })
			})
		})

		describe('setItem()', () => {
			test('returns new runtime with updated item (draft)', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: false, item2: false } as any)
				const updated = draft.setItem('item1' as any, true)

				expect(updated.getItem('item1' as any)).toBe(true)
				expect(draft.getItem('item1' as any)).toBe(false) // original unchanged
			})

		})

		describe('updateItems()', () => {
			test('returns new runtime with multiple items updated', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: false, item2: false } as any)
				const updated = draft.updateItems({ item1: true, item2: true })

				expect(updated.getAllItems()).toEqual({ item1: true, item2: true })
			})

		})

		describe('setTargetLayer()', () => {
			test('changes target layer (draft)', () => {
				// Use direct object pattern for proper type inference
				const instance = checklist({
					name: 'multi-layer',
					version: '1.0.0',
					title: 'Multi Layer',
					items: [{ id: 'item1', title: 'Item' }] as const,
					layers: {
						text: { kind: 'inline', mimeType: 'text/plain', text: 'Text' },
						html: { kind: 'inline', mimeType: 'text/html', text: '<p>HTML</p>' },
					},
					defaultLayer: 'text',
				})

				const draft = instance.fill({ item1: true })
				const updated = draft.setTargetLayer('html')

				expect(updated.targetLayer).toBe('html')
				expect(draft.targetLayer).toBe('text')
			})

			test('throws for non-existent layer', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: true, item2: true } as any)

				// Use runtime test - the type system can't catch this
				expect(() => (draft as any).setTargetLayer('nonexistent')).toThrow('Layer "nonexistent" not found')
			})

		})

		describe('complete()', () => {
			test('transitions to completed phase', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: true, item2: true } as any)
				const completed = draft.complete()

				expect(completed.phase).toBe('completed')
				expect(completed.completedAt).toBeDefined()
				expect(typeof completed.completedAt).toBe('string')
			})

		})

		describe('render()', () => {
			test('renders target layer content', async () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)
				const output = await runtime.render()

				expect(output).toBe('Checklist content')
			})

			test('allows layer override', async () => {
				const instance = checklist()
					.name('multi-layer')
					.version('1.0.0')
					.title('Multi Layer')
					.item({ id: 'item1', title: 'Item' })
					.inlineLayer('text', { mimeType: 'text/plain', text: 'Text' })
					.inlineLayer('html', { mimeType: 'text/html', text: '<p>HTML</p>' })
					.defaultLayer('text')
					.build()

				const runtime = instance.fill({ item1: true } as any)
				const output = await runtime.render({ layer: 'html' })

				expect(output).toBe('<p>HTML</p>')
			})
		})

		describe('toJSON()', () => {
			test('returns draft JSON format', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: true, item2: false } as any)
				const json = draft.toJSON()

				expect(json.phase).toBe('draft')
				expect(json.items).toEqual({ item1: true, item2: false })
				expect('completedAt' in json).toBe(false)
			})

			test('returns completed JSON format', () => {
				const instance = createChecklistWithItems()
				const completed = instance.fill({ item1: true, item2: true } as any).complete()
				const json = completed.toJSON()

				expect(json.phase).toBe('completed')
				expect('completedAt' in json).toBe(true)
			})
		})

		describe('toYAML()', () => {
			test('returns valid YAML', () => {
				const instance = createChecklistWithItems()
				const runtime = instance.fill({ item1: true, item2: false } as any)
				const yaml = runtime.toYAML()

				expect(typeof yaml).toBe('string')
				expect(yaml).toContain('phase: draft')
			})
		})

		describe('clone()', () => {
			test('creates independent copy', () => {
				const instance = createChecklistWithItems()
				const draft = instance.fill({ item1: true, item2: false } as any)
				const copy = draft.clone()

				expect(copy.phase).toBe(draft.phase)
				expect(copy.getAllItems()).toEqual(draft.getAllItems())
				expect(copy).not.toBe(draft)
			})

			test('preserves completed state', () => {
				const instance = createChecklistWithItems()
				const completed = instance.fill({ item1: true, item2: true } as any).complete()
				const copy = completed.clone()

				expect(copy.phase).toBe('completed')
				expect(copy.completedAt).toBe(completed.completedAt)
			})
		})

		describe('runtimeChecklistFromJSON()', () => {
			test('loads draft from JSON', () => {
				const instance = createChecklistWithItems()
				const original = instance.fill({ item1: true, item2: false } as any)
				const json = original.toJSON()
				const loaded = runtimeChecklistFromJSON(json)

				expect(loaded.phase).toBe('draft')
				expect(loaded.getAllItems()).toEqual({ item1: true, item2: false })
			})

			test('loads completed from JSON', () => {
				const instance = createChecklistWithItems()
				const original = instance.fill({ item1: true, item2: true } as any).complete()
				const json = original.toJSON()
				const loaded = runtimeChecklistFromJSON(json)

				expect(loaded.phase).toBe('completed')
				expect(loaded.completedAt).toBe(original.completedAt)
			})
		})
	})

	// ============================================================================
	// Builder Tests
	// ============================================================================

	describe('ChecklistBuilder', () => {
		test('chains methods fluently', () => {
			const instance = checklist()
				.name('chained')
				.version('2.0.0')
				.title('Chained Checklist')
				.description('Built with chaining')
				.code('CHN-001')
				.releaseDate('2024-01-01')
				.metadata({ custom: 'value' })
				.build()

			expect(instance.name).toBe('chained')
			expect(instance.version).toBe('2.0.0')
			expect(instance.title).toBe('Chained Checklist')
			expect(instance.description).toBe('Built with chaining')
			expect(instance.code).toBe('CHN-001')
			expect(instance.releaseDate).toBe('2024-01-01')
			expect(instance.metadata).toEqual({ custom: 'value' })
		})

		test('from() initializes from existing checklist', () => {
			const original = createChecklistWithItems()
			const copy = checklist().from(original._data).name('modified-name').build()

			expect(copy.name).toBe('modified-name')
			expect(copy.title).toBe(original.title)
		})

		test('item() adds single item', () => {
			const instance = checklist()
				.name('checklist')
				.version('1.0.0')
				.title('Checklist')
				.item({ id: 'item1', title: 'Item 1' })
				.build()

			expect(instance.items).toHaveLength(1)
			// Use array access with type assertion since builder doesn't track items
			const items = instance.items as Array<{ id: string; title: string }>
			expect(items[0]?.id).toBe('item1')
		})

		test('items() sets multiple items', () => {
			const instance = checklist()
				.name('checklist')
				.version('1.0.0')
				.title('Checklist')
				.items([
					{ id: 'item1', title: 'Item 1' },
					{ id: 'item2', title: 'Item 2' },
				])
				.build()

			expect(instance.items).toHaveLength(2)
		})

		test('itemWithBooleanStatus() adds boolean item', () => {
			const instance = checklist()
				.name('checklist')
				.version('1.0.0')
				.title('Checklist')
				.itemWithBooleanStatus('done', 'Mark as Done', { default: false })
				.build()

			// Use array access with type assertion since builder doesn't track items
			const items = instance.items as Array<{ id: string; status?: { kind: string } }>
			expect(items[0]?.id).toBe('done')
			expect(items[0]?.status?.kind).toBe('boolean')
		})

		test('itemWithEnumStatus() adds enum item', () => {
			const instance = checklist()
				.name('checklist')
				.version('1.0.0')
				.title('Checklist')
				.itemWithEnumStatus('status', 'Status', {
					statusOptions: [
						{ value: 'pending', label: 'Pending' },
						{ value: 'done', label: 'Done' },
					],
				})
				.build()

			// Use array access with type assertion since builder doesn't track items
			const items = instance.items as Array<{ id: string; status?: { kind: string } }>
			expect(items[0]?.id).toBe('status')
			expect(items[0]?.status?.kind).toBe('enum')
		})
	})

	// ============================================================================
	// Direct Object Pattern
	// ============================================================================

	describe('direct object pattern', () => {
		test('creates checklist from object literal', () => {
			const instance = checklist({
				name: 'direct-checklist',
				version: '1.0.0',
				title: 'Direct Checklist',
				items: [{ id: 'item1', title: 'Item 1' }],
				layers: {
					main: { kind: 'inline', mimeType: 'text/plain', text: 'Content' },
				},
				defaultLayer: 'main',
			})

			expect(instance.name).toBe('direct-checklist')
			expect(instance.kind).toBe('checklist')
			expect(instance.items).toHaveLength(1)
		})
	})

	// ============================================================================
	// Type Inference Tests
	// ============================================================================

	describe('type inference', () => {
		test('InferChecklistPayload works with boolean items', () => {
			const instance = checklist({
				name: 'typed',
				version: '1.0.0',
				title: 'Typed',
				items: [{ id: 'done', title: 'Done', status: { kind: 'boolean' } }] as const,
			})

			// Type check: fill should accept { done: boolean }
			const runtime = instance.fill({ done: true })
			expect(runtime.getItem('done')).toBe(true)
		})

		test('InferChecklistPayload works with enum items', () => {
			const instance = checklist({
				name: 'typed',
				version: '1.0.0',
				title: 'Typed',
				items: [
					{
						id: 'status',
						title: 'Status',
						status: {
							kind: 'enum',
							options: [
								{ value: 'open', label: 'Open' },
								{ value: 'closed', label: 'Closed' },
							],
						},
					},
				] as const,
			})

			// Type check: fill should accept { status: string }
			const runtime = instance.fill({ status: 'open' })
			expect(runtime.getItem('status')).toBe('open')
		})
	})
})
