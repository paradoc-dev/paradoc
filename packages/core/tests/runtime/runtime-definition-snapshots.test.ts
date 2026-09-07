import { describe, expect, test } from 'vitest'
import { bundle, checklist, document, form, runtimeFormFromJSON } from '@/artifacts'

describe('runtime definition snapshots', () => {
	test('keeps a form instance on its original constraints and rules', () => {
		const definition = form({
			name: 'mutable-form',
			version: '1.0.0',
			title: 'Mutable form',
			fields: {
				age: { type: 'number', min: 0 },
			},
			rules: {
				adult: { expr: 'age >= 18', message: 'Must be an adult' },
			},
		})

		const original = definition.fill({ fields: { age: 20 } })
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			fields?: Record<string, { min?: number }>
			rules?: Record<string, { expr: string }>
		}
		;(authoring.fields!.age as { min?: number }).min = 50
		;(authoring.rules!.adult as { expr: string }).expr = 'age >= 65'

		expect(() => original.setField('age', 20)).not.toThrow()
		expect(definition.safeFill({ fields: { age: 20 } }).success).toBe(false)
		expect(definition.safeFill({ fields: { age: 65 } }).success).toBe(true)
	})

	test('snapshots checklist status definitions for each filled instance', () => {
		const definition = checklist({
			name: 'mutable-checklist',
			version: '1.0.0',
			title: 'Mutable checklist',
			items: [{ id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' } }],
		})
		const original = definition.fill({ reviewed: true })
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			items: Array<{ status?: { kind: string; options?: Array<{ value: string; label: string }> } }>
		}
		authoring.items[0]!.status = {
			kind: 'enum',
			options: [{ value: 'approved', label: 'Approved' }],
		}

		expect(() => original.setItem('reviewed', false)).not.toThrow()
		expect(definition.safeFill({ reviewed: 'approved' } as never).success).toBe(true)
	})

	test('snapshots document layers when preparing a runtime document', async () => {
		const definition = document({
			name: 'mutable-document',
			version: '1.0.0',
			title: 'Mutable document',
			layers: {
				default: { kind: 'inline', mimeType: 'text/plain', text: 'before' },
			},
		})
		const original = definition.prepare()
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			layers?: Record<string, { text: string }>
		}
		;(authoring.layers!.default as { text: string }).text = 'after'

		expect(await original.render()).toBe('before')
		expect(await definition.prepare().render()).toBe('after')
	})

	test('snapshots bundle content keys when preparing a runtime bundle', () => {
		const definition = bundle({
			name: 'mutable-bundle',
			version: '1.0.0',
			title: 'Mutable bundle',
			contents: [
				{
					type: 'path',
					key: 'original',
					path: './document.yaml',
				},
			],
		})
		const original = definition.prepare()
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			contents: Array<{ key: string }>
		}
		authoring.contents[0]!.key = 'updated'
		const content = document({
			name: 'bundle-content',
			version: '1.0.0',
			title: 'Bundle content',
		}).prepare()

		expect(() => original.setContent('original', content)).not.toThrow()
		expect(() => definition.prepare().setContent('updated', content)).not.toThrow()
		expect(() => original.setContent('updated', content)).toThrow('not found')
	})

	test('rejects malformed authoring definitions before creating new instances', () => {
		const definition = form({
			name: 'invalid-after-edit',
			version: '1.0.0',
			title: 'Invalid after edit',
			fields: { age: { type: 'number', min: 0 } },
		})
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			fields?: Record<string, { type: string }>
		}
		;(authoring.fields!.age as { type: string }).type = 'unknown'

		const result = definition.safeFill({ fields: { age: 20 } })
		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error.message).toContain('Invalid form definition')
		}
	})

	test('detaches a restored runtime definition from the serialized input', () => {
		const definition = form({
			name: 'restored-form',
			version: '1.0.0',
			title: 'Restored form',
			fields: { age: { type: 'number', min: 0 } },
		})
		const runtime = definition.fill({ fields: { age: 20 } })
		const serialized = runtime.toJSON()
		const restored = runtimeFormFromJSON(serialized)
		const restoredDefinition = serialized.form as unknown as { fields?: Record<string, { min?: number }> }
		;(restoredDefinition.fields!.age as { min?: number }).min = 50

		expect(restored.phase).toBe('draft')
		if (restored.phase === 'draft') {
			expect(() => restored.setField('age', 20)).not.toThrow()
		}
	})
})
