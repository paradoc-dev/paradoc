import { describe, expect, test } from 'vitest'
import { para, type InferFormPayload } from '@/index'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

describe('definition payload inference', () => {
	test('keeps requiredness equivalent between literal and builder forms', () => {
		const literal = para.form({
			kind: 'form',
			name: 'literal',
			fields: {
				age: { type: 'number', required: true },
				comment: { type: 'text' },
			},
		})
		const built = para
			.form()
			.name('built')
			.fields({
				age: para.field.number().required(),
				comment: para.field.text(),
			})
			.build()

		type LiteralPayload = InferFormPayload<typeof literal>
		type BuiltPayload = InferFormPayload<typeof built>
		const payloadTypesMatch: Equal<LiteralPayload, BuiltPayload> = true
		const literalPayload: LiteralPayload = { fields: { age: 42 } }
		const builtPayload: BuiltPayload = { fields: { age: 42 } }
		expect(literalPayload).toEqual(builtPayload)
		expect(payloadTypesMatch).toBe(true)

		const checkRequiredFillType = () => {
			// @ts-expect-error required builder fields must be supplied to a complete fill
			built.fill({ fields: {} })
		}
		void checkRequiredFillType
	})

	test('allows optional party and annex sections to be omitted', () => {
		const form = para
			.form()
			.name('optional-sections')
			.fields({ age: { type: 'number', required: true } })
			.parties({ buyer: para.party().label('Buyer').required(false).min(0) })
			.annexes({ proof: para.annex().title('Proof').required(false) })
			.build()

		const draft = form.fill({ fields: { age: 42 } })
		expect(draft.fields.age).toBe(42)
	})

	test('keeps singular builder definitions in the inferred payload', () => {
		const form = para
			.form()
			.name('singular-builder')
			.field('age', para.field.number().required())
			.party('buyer', para.party().label('Buyer').required(false).min(0))
			.annex('proof', para.annex().required(false))
			.build()

		type Payload = InferFormPayload<typeof form>
		const payload: Payload = { fields: { age: 42 } }
		expect(form.fill(payload).fields.age).toBe(42)
	})

	test('accepts readonly generated collection definitions', () => {
		const bundleSchema = {
			kind: 'bundle',
			name: 'generated-bundle',
			contents: [{ type: 'path', key: 'document', path: './document.json' }],
		} as const
		const checklistSchema = {
			kind: 'checklist',
			name: 'generated-checklist',
			items: [{ id: 'first', title: 'First', status: { kind: 'boolean' } }],
		} as const

		const bundle = para.bundle(bundleSchema)
		const checklist = para.checklist(checklistSchema)
		const mutableBundleSchema = {
			kind: 'bundle' as const,
			name: 'mutable-bundle',
			contents: [{ type: 'path' as const, key: 'document', path: './document.json' }],
		}
		const mutableChecklistSchema = {
			kind: 'checklist' as const,
			name: 'mutable-checklist',
			items: [{ id: 'first', title: 'First', status: { kind: 'boolean' as const } }],
		}
		para.bundle(mutableBundleSchema)
		para.checklist(mutableChecklistSchema)
		mutableBundleSchema.contents.push({ type: 'path', key: 'second', path: './second.json' })
		mutableChecklistSchema.items.push({ id: 'second', title: 'Second', status: { kind: 'boolean' } })
		expect(bundle.contents).toHaveLength(1)
		expect(checklist.items).toHaveLength(1)
		expect(bundleSchema.contents).toHaveLength(1)
		expect(checklistSchema.items).toHaveLength(1)
	})
})
