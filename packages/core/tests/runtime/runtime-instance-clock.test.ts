import { describe, expect, test, vi } from 'vitest'
import { bundle, checklist, form, runtimeChecklistFromJSON, runtimeFormFromJSON } from '@/artifacts'

const asOf = '2026-09-12T12:34:56-05:00'

function createClockForm() {
	return form({
		kind: 'form',
		name: 'clock-probe',
		fields: {
			deadline: { type: 'date' },
		},
		defs: {
			capturedToday: { type: 'date', value: 'today()' },
			capturedNow: { type: 'datetime', value: 'now()' },
		},
	} as any)
}

describe('runtime artifact clock context', () => {
	test('uses an explicit clock for temporal expressions and retains it across lifecycles', () => {
		const definition = createClockForm()
		const draft = definition.partialFill(
			{ fields: { deadline: '2026-09-10' } } as any,
			{ context: { asOf } },
		)

		expect(draft.context.asOf).toEqual({
			date: '2026-09-12',
			datetime: '2026-09-12T17:34:56.000Z',
		})
		expect(draft.getLogicValue('capturedToday')).toBe('2026-09-12')
		expect(draft.getLogicValue('capturedNow')).toBe('2026-09-12T17:34:56.000Z')
		const updated = draft.update({ fields: { deadline: '2026-09-20' } } as any)
		const cloned = updated.clone()
		const restored = runtimeFormFromJSON(updated.toJSON())
		const signable = updated.prepareForSigning()
		const executed = signable.finalize()

		for (const instance of [updated, cloned, restored, signable, executed]) {
			expect(instance.context).toEqual(draft.context)
			expect(instance.getLogicValue('capturedToday')).toBe('2026-09-12')
		}
	})

	test('captures the wall clock once when omitted and keeps later evaluation stable', () => {
		vi.useFakeTimers()
		try {
			vi.setSystemTime(new Date('2026-09-12T23:59:59.000Z'))
			const draft = createClockForm().partialFill()
			const captured = draft.context

			vi.setSystemTime(new Date('2026-09-13T00:00:01.000Z'))
			const updated = draft.update({ fields: { deadline: '2026-09-01' } } as any)
			const restored = runtimeFormFromJSON(draft.toJSON())

			expect(captured).toEqual({
				asOf: { date: '2026-09-12', datetime: '2026-09-12T23:59:59.000Z' },
			})
			expect(updated.context).toEqual(captured)
			expect(updated.getLogicValue('capturedToday')).toBe('2026-09-12')
			expect(restored.context).toEqual(captured)
			expect(restored.getLogicValue('capturedNow')).toBe('2026-09-12T23:59:59.000Z')
		} finally {
			vi.useRealTimers()
		}
	})

	test('forwards context through safe fill paths and rejects invalid timestamps', () => {
		const definition = createClockForm()
		const safePartial = definition.safePartialFill(undefined, { context: { asOf } })
		const safeFull = definition.safeFill(
			{ fields: { deadline: '2026-09-10' } } as any,
			{ context: { asOf }, rules: false },
		)

		expect(safePartial.success && safePartial.data.context.asOf.date).toBe('2026-09-12')
		expect(safeFull.success && safeFull.data.context.asOf.datetime).toBe('2026-09-12T17:34:56.000Z')
		expect(() => definition.partialFill(undefined, { context: { asOf: '2026-09-12' } })).toThrow(
			/Invalid context\.asOf/,
		)
		expect(definition.safePartialFill(undefined, { context: { asOf: 'not-a-timestamp' } }).success).toBe(false)
	})

	test('retains the same context for checklist instances and serialized bundle content', () => {
		const definition = checklist({
			name: 'clock-checklist',
			items: [{ id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' } }],
		})
		const draft = definition.fill({ reviewed: true }, { context: { asOf } })
		const restored = runtimeChecklistFromJSON(draft.toJSON())
		const completed = draft.complete()

		expect(draft.context).toEqual(restored.context)
		expect(completed.context).toEqual(draft.context)
		expect(completed.clone().context).toEqual(draft.context)

		const bundleDefinition = bundle()
			.name('clock-bundle')
			.inline('clock-form', createClockForm())
			.build()
		const runtimeBundle = bundleDefinition.prepare({ 'clock-form': draft })
		expect(runtimeBundle.toJSON().contents['clock-form']?.context).toEqual(draft.context)
	})
})
