import { describe, expect, test } from 'vitest'
import { bundle, document, form, runtimeBundleFromJSON } from '@/artifacts'

function fixture() {
	const formA = form()
		.name('form-a')
		.version('1.0.0')
		.title('Form A')
		.fields({ name: { type: 'text', label: 'Name' } })
		.build()
	const formB = form()
		.name('form-b')
		.version('1.0.0')
		.title('Form B')
		.fields({ name: { type: 'text', label: 'Name' } })
		.build()
	const notes = document().name('notes').version('1.0.0').title('Notes').build()
	const definition = bundle()
		.name('packet')
		.version('1.0.0')
		.title('Packet')
		.inline('formA', formA)
		.inline('formB', formB)
		.build()
	const draft = definition.prepare({
		formA: formA.fill({ fields: { name: 'A' } }),
		formB: formB.fill({ fields: { name: 'B' } }),
	})
	return { formA, formB, notes, draft, signable: draft.prepareForSigning() }
}

describe('bundle content mutation', () => {
	describe('updateContent on a signable bundle', () => {
		test('accepts a signable instance of the declared kind, and the bundle finalizes', () => {
			const { formB, signable } = fixture()
			const updated = signable.updateContent('formB', formB.fill({ fields: { name: 'B2' } }).prepareForSigning())

			expect(updated.phase).toBe('signable')
			expect(updated.getContent('formB')?.phase).toBe('signable')
			expect(updated.finalize().phase).toBe('executed')
		})

		test('rejects a draft-phase instance at the call, naming the phase mismatch', () => {
			const { formB, signable } = fixture()

			expect(() => signable.updateContent('formB', formB.fill({ fields: { name: 'B2' } }))).toThrow(
				'Cannot updateContent: content "formB" is a form in draft phase, but a signable bundle requires signable phase'
			)
		})

		test('rejects a key the bundle does not declare', () => {
			const { formB, signable } = fixture()

			expect(() => signable.updateContent('missing', formB.fill().prepareForSigning())).toThrow(
				'Content key "missing" not found in bundle definition. Available keys: formA, formB'
			)
		})

		test('rejects an instance of the wrong kind for the part', () => {
			const { notes, signable } = fixture()

			expect(() => signable.updateContent('formB', notes.prepare().finalize())).toThrow(
				'Cannot updateContent: content "formB" must be a form instance, got a document'
			)
		})

		test('rejects a value that is not a runtime instance', () => {
			const { signable } = fixture()
			const notAnInstance = { phase: 'signable' } as unknown as Parameters<typeof signable.updateContent>[1]

			expect(() => signable.updateContent('formB', notAnInstance)).toThrow(
				'Cannot updateContent: content "formB" is not a form, checklist, document, or bundle instance'
			)
		})
	})

	describe('draft bundle mutation', () => {
		test('setContent and updateContents accept draft instances', () => {
			const { formA, formB, draft } = fixture()
			const updated = draft
				.setContent('formA', formA.fill({ fields: { name: 'A2' } }))
				.updateContents({ formB: formB.fill({ fields: { name: 'B2' } }) })

			expect(updated.getContent('formA')?.phase).toBe('draft')
			expect(updated.prepareForSigning().phase).toBe('signable')
		})

		test('setContent rejects a signable instance', () => {
			const { formA, draft } = fixture()

			expect(() => draft.setContent('formA', formA.fill().prepareForSigning())).toThrow(
				'Cannot setContent: content "formA" is a form in signable phase, but a draft bundle requires draft phase'
			)
		})

		test('updateContents rejects an instance of the wrong kind', () => {
			const { notes, draft } = fixture()

			expect(() => draft.updateContents({ formB: notes.prepare() })).toThrow(
				'Cannot updateContents: content "formB" must be a form instance, got a document'
			)
		})
	})

	test('prepare applies the same checks to its initial contents', () => {
		const { formA, notes } = fixture()
		const definition = bundle().name('packet').version('1.0.0').title('Packet').inline('formA', formA).build()

		expect(() => definition.prepare({ formA: formA.fill().prepareForSigning() })).toThrow(
			'Cannot updateContents: content "formA" is a form in signable phase, but a draft bundle requires draft phase'
		)
		expect(() => definition.prepare({ formA: notes.prepare() })).toThrow(
			'Cannot updateContents: content "formA" must be a form instance, got a document'
		)
		expect(() => definition.prepare({ missing: formA.fill() })).toThrow(
			'Content key "missing" not found in bundle definition'
		)
	})

	test('finalize names the kind and phase of content it cannot move', () => {
		const { formB, signable } = fixture()
		const loaded = runtimeBundleFromJSON(signable.toJSON(), () => formB.fill())
		if (loaded.phase !== 'signable') throw new Error('expected a signable bundle')

		expect(() => loaded.finalize()).toThrow(
			'Cannot finalize: expected signable-phase content, got a form in draft phase'
		)
	})
})
