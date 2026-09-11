import { describe, expect, test } from 'vitest'
import { p, type InferFormPayload, type ProgressiveFormPayload } from '@/index'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

describe('definition payload inference', () => {
	test('keeps requiredness equivalent between literal and builder forms', () => {
		const literal = p.form({
			kind: 'form',
			name: 'literal',
			fields: {
				age: { type: 'number', required: true },
				comment: { type: 'text' },
			},
		})
		const built = p
			.form()
			.name('built')
			.fields({
				age: p.field.number().required(),
				comment: p.field.text(),
			})
			.build()

		type LiteralPayload = InferFormPayload<typeof literal>
		type BuiltPayload = InferFormPayload<typeof built>
		const payloadTypesMatch: Equal<LiteralPayload, BuiltPayload> = true
		const literalPayload: LiteralPayload = { fields: { age: 42 } }
		const builtPayload: BuiltPayload = { fields: { age: 42 } }
		expect(literalPayload).toEqual(builtPayload)
		expect(payloadTypesMatch).toBe(true)

		expect(built.fill({ fields: {} }).isValid()).toBe(false)
	})

	test('allows optional party and annex sections to be omitted', () => {
		const form = p
			.form()
			.name('optional-sections')
			.fields({ age: { type: 'number', required: true } })
			.parties({ buyer: p.party().label('Buyer').required(false).min(0) })
			.annexes({ proof: p.annex().title('Proof').required(false) })
			.build()

		const draft = form.fill({ fields: { age: 42 } })
		expect(draft.fields.age).toBe(42)
	})

	test('keeps singular builder definitions in the inferred payload', () => {
		const form = p
			.form()
			.name('singular-builder')
			.field('age', p.field.number().required())
			.party('buyer', p.party().label('Buyer').required(false).min(0))
			.annex('proof', p.annex().required(false))
			.build()

		type Payload = InferFormPayload<typeof form>
		const payload: Payload = { fields: { age: 42 } }
		expect(form.fill(payload).fields.age).toBe(42)
	})

	test('preserves nested fieldset and list inference through fluent builders', () => {
		const profileBuilder = p.field
			.fieldset()
			.field('age', p.field.number().required())
		const formBuilder = p
			.form()
			.name('nested-builder')
			.field('profile', profileBuilder)
			.field('phones', p.field.list().item(p.field.phone()))
		const before = formBuilder.build()
		profileBuilder.field('nickname', p.field.text())
		const form = formBuilder.build()
		expect((before.fields.profile as any).fields.nickname).toBeUndefined()
		expect((form.fields.profile as any).fields.nickname).toEqual({ type: 'text' })

		type Payload = InferFormPayload<typeof form>
		const payload: Payload = { fields: { profile: { age: 42 }, phones: [] } }
		expect(payload.fields.profile?.age).toBe(42)
		const draft = form.fill(payload)
		expect(draft.fields.profile).toEqual({ age: 42 })
		expect(draft.fields.phones).toEqual([])

		expect(form.fill({ fields: { profile: {}, phones: [] } }).isValid()).toBe(false)
	})

	test('allows recursive nested patches while preserving full payload strictness', () => {
		const form = p.form({
			kind: 'form',
			name: 'progressive-nested',
			fields: {
				profile: {
					type: 'fieldset',
					fields: {
						firstName: { type: 'text', required: true },
						lastName: { type: 'text', required: true },
					},
				},
				rows: {
					type: 'list',
					item: { type: 'fieldset', fields: { label: { type: 'text' } } },
				},
			},
		})

		type FullPayload = InferFormPayload<typeof form>
		type ProgressivePayload = ProgressiveFormPayload<typeof form>
		const fullPayload: FullPayload = {
			fields: { profile: { firstName: 'Ada', lastName: 'Lovelace' } },
		}
		const nestedPatch: ProgressivePayload = {
			fields: { profile: { firstName: 'Grace' }, rows: [{ label: 'work' }] },
		}
		// @ts-expect-error progressive patches still validate supplied values
		const invalidPatch: ProgressivePayload = { fields: { profile: { firstName: 42 } } }

		expect(form.fill(fullPayload).fields.profile).toEqual(fullPayload.fields.profile)
		expect(form.fill(nestedPatch).fields.profile).toEqual({ firstName: 'Grace' })
		void invalidPatch
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

		const bundle = p.bundle(bundleSchema)
		const checklist = p.checklist(checklistSchema)
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
		p.bundle(mutableBundleSchema)
		p.checklist(mutableChecklistSchema)
		mutableBundleSchema.contents.push({ type: 'path', key: 'second', path: './second.json' })
		mutableChecklistSchema.items.push({ id: 'second', title: 'Second', status: { kind: 'boolean' } })
		expect(bundle.contents).toHaveLength(1)
		expect(checklist.items).toHaveLength(1)
		expect(bundleSchema.contents).toHaveLength(1)
		expect(checklistSchema.items).toHaveLength(1)
	})
})
