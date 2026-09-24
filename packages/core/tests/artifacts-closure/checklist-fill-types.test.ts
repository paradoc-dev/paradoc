import { describe, expect, test } from 'vitest'
import { checklist } from '@/index'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/**
 * `ChecklistInstance.safeFill` must accept the same optional, progressive
 * payload as `fill`, and the inferred checklist payload must keep each
 * item's own id and value type instead of collapsing to an open record.
 *
 * The assertions below are type-level: `pnpm check-types` fails if fill
 * inference regresses, because either a `@ts-expect-error` stops being
 * needed (an invalid call starts compiling) or a valid call stops
 * compiling. `npx vitest run` alone does not check these — they only bite
 * through `tsc`, which is why `check-types` is part of verification.
 */
describe('checklist fill payload inference', () => {
	const withStatuses = checklist({
		name: 'onboarding',
		items: [
			{ id: 'signed', title: 'Signed', status: { kind: 'boolean' } },
			{
				id: 'stage',
				title: 'Stage',
				status: {
					kind: 'enum',
					options: [
						{ value: 'pending', label: 'Pending' },
						{ value: 'done', label: 'Done' },
					],
				},
			},
		],
	} as const)

	test('safeFill() accepts no seed', () => {
		const result = withStatuses.safeFill()

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.getAllItems()).toEqual({})
		}
	})

	test('safeFill() accepts a partial seed', () => {
		const result = withStatuses.safeFill({ signed: true })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.getItem('signed')).toBe(true)
		}
	})

	test('type: safeFill() accepts no seed, a partial seed, and rejects bad payloads', () => {
		// No seed at all: safeFill is optional and progressive, same as fill.
		const noSeed = withStatuses.safeFill()

		// A partial seed with only some items answered.
		const oneItem = withStatuses.safeFill({ signed: true })
		const otherItem = withStatuses.safeFill({ stage: 'pending' })
		const bothItems = withStatuses.safeFill({ signed: true, stage: 'done' })

		// @ts-expect-error an unknown item id must be rejected
		const unknownItem = withStatuses.safeFill({ notAnItem: true })

		// @ts-expect-error a boolean item cannot take a string value
		const wrongValueType = withStatuses.safeFill({ signed: 'true' })

		// @ts-expect-error an enum item is limited to its declared option values
		const wrongEnumValue = withStatuses.safeFill({ stage: 'not-an-option' })

		void [noSeed, oneItem, otherItem, bothItems, unknownItem, wrongValueType, wrongEnumValue]
	})

	test('type: fill() and safeFill() infer the same per-item payload', () => {
		type FillSeed = Parameters<typeof withStatuses.fill>[0]
		type SafeFillSeed = Parameters<typeof withStatuses.safeFill>[0]

		const seedTypesMatch: Equal<FillSeed, SafeFillSeed> = true
		expect(seedTypesMatch).toBe(true)
	})
})
