import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'

function createFormWithDefaults() {
	return form()
		.name('clear-reset')
		.fields({
			title: { type: 'text', default: 'Untitled' },
			count: { type: 'number', default: 0 },
			settings: {
				type: 'fieldset',
				fields: {
					enabled: { type: 'boolean', default: false },
					note: { type: 'text' },
				},
			},
			rows: {
				type: 'list',
				item: {
					type: 'fieldset',
					fields: {
						label: { type: 'text', default: 'Row' },
						value: { type: 'number' },
					},
				},
			},
		})
		.annex('proof', { title: 'Proof' })
		.build()
}

describe('DraftForm clear and reset', () => {
	test('applies recursive defaults at creation, including existing list rows', () => {
		const draft = createFormWithDefaults().fill({ fields: { settings: {}, rows: [{}] } } as never)

		expect(draft.fields).toMatchObject({
			title: 'Untitled',
			count: 0,
			settings: { enabled: false },
			rows: [{ label: 'Row' }],
		})
	})

	test('clears a defaulted value and keeps it absent across unrelated updates until reset', () => {
		const draft = createFormWithDefaults().fill({ fields: { title: 'Custom', count: 1 } } as never)
		const cleared = draft.clear('fields.title')

		expect(cleared.fields).not.toHaveProperty('title')
		const updated = cleared.update({ fields: { count: 2 } } as never)
		expect(updated.fields).not.toHaveProperty('title')

		const reset = updated.reset('fields.title')
		expect(reset.fields.title).toBe('Untitled')
	})

	test('clears and resets nested fieldsets and list item paths', () => {
		const draft = createFormWithDefaults().fill({
			fields: { settings: { enabled: true, note: 'Keep' }, rows: [{ label: 'First', value: 7 }] },
		} as never)

		const clearedNested = draft.clear('fields.settings.enabled')
		expect(clearedNested.fields.settings).toEqual({ note: 'Keep' })
		const resetNested = clearedNested.reset('fields.settings.enabled')
		expect(resetNested.fields.settings).toEqual({ enabled: false, note: 'Keep' })

		const clearedListValue = resetNested.clear('fields.rows[0].label')
		expect(clearedListValue.fields.rows).toEqual([{ value: 7 }])
		const resetListValue = clearedListValue.reset('fields.rows[0].label')
		expect(resetListValue.fields.rows).toEqual([{ label: 'Row', value: 7 }])
	})

	test('reset does not invent list rows and annex reset removes the stored value', () => {
		const draft = createFormWithDefaults().fill({
			fields: { rows: [{ label: 'First' }] },
			annexes: { proof: { path: 'proof.pdf' } },
		} as never)

		const cleared = draft.clear('fields.rows').clear('annexes.proof')
		const reset = cleared.reset('fields.rows').reset('annexes.proof')

		expect(reset.fields).not.toHaveProperty('rows')
		expect(reset.annexes).not.toHaveProperty('proof')
	})

	test('rejects paths that are not present in the definition', () => {
		const draft = createFormWithDefaults().fill({ fields: {} } as never)

		expect(() => draft.clear('fields.unknown' as never)).toThrow('unknown field')
		expect(() => draft.reset('fields.rows.label' as never)).toThrow('numeric bracket index')
		expect(() => draft.clear('annexes.unknown' as never)).toThrow('unknown annex')
	})

	test('reset uses the instance definition snapshot', () => {
		const definition = createFormWithDefaults()
		const draft = definition.fill({ fields: { title: 'Custom' } } as never)
		const authoring = definition.toJSON({ includeSchema: false }) as unknown as {
			fields?: Record<string, { default?: string }>
		}
		;(authoring.fields!.title as { default?: string }).default = 'Changed later'

		expect(draft.reset('fields.title').fields.title).toBe('Untitled')
	})
})
